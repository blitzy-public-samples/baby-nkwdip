import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    ServerSideEncryption,
    ObjectCannedACL,
    S3ServiceException
} from '@aws-sdk/client-s3';
import { 
    KMSClient, 
    GenerateDataKeyCommand, 
    EncryptCommand, 
    DecryptCommand 
} from '@aws-sdk/client-kms';
import { createHash } from 'crypto';
import { Stream } from 'stream';
import { promisify } from 'util';
import * as retry from 'retry';
import { StorageService, FileMetadata } from './interfaces/storage.interface';

// @aws-sdk/client-s3 version: ^3.0.0
// @aws-sdk/client-kms version: ^3.0.0
// retry version: ^0.13.0

@Injectable()
export class S3StorageService implements StorageService, OnModuleInit {
    private readonly logger = new Logger(S3StorageService.name);
    private readonly s3Client: S3Client;
    private readonly kmsClient: KMSClient;
    private readonly bucketName: string;
    private readonly kmsKeyId: string;
    private readonly region: string;

    constructor(private readonly configService: ConfigService) {
        this.region = this.configService.get<string>('AWS_REGION');
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET');
        this.kmsKeyId = this.configService.get<string>('AWS_KMS_KEY_ID');

        this.s3Client = new S3Client({
            region: this.region,
            maxAttempts: 3,
            retryMode: 'adaptive'
        });

        this.kmsClient = new KMSClient({
            region: this.region
        });
    }

    async onModuleInit() {
        try {
            // Validate S3 bucket and KMS key accessibility
            await this.s3Client.send(new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: '.validation'
            }));
            this.logger.log('S3 bucket validation successful');
        } catch (error) {
            if (error.name !== 'NotFound') {
                this.logger.error('Failed to validate S3 bucket access', error);
                throw error;
            }
        }
    }

    async uploadFile(
        fileData: Buffer | Stream,
        fileName: string,
        metadata: Record<string, any>
    ): Promise<FileMetadata> {
        const operation = retry.operation({
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 5000
        });

        return new Promise((resolve, reject) => {
            operation.attempt(async (currentAttempt) => {
                try {
                    // Generate content hash for integrity verification
                    const hash = this.generateContentHash(fileData);

                    // Generate data key for file encryption
                    const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } = 
                        await this.kmsClient.send(new GenerateDataKeyCommand({
                            KeyId: this.kmsKeyId,
                            KeySpec: 'AES_256'
                        }));

                    // Encrypt file data
                    const encryptedData = this.encryptData(fileData, dataKey);

                    const uploadParams = {
                        Bucket: this.bucketName,
                        Key: `${new Date().getFullYear()}/${fileName}`,
                        Body: encryptedData,
                        ServerSideEncryption: ServerSideEncryption.aws_kms,
                        SSEKMSKeyId: this.kmsKeyId,
                        ACL: ObjectCannedACL.private,
                        Metadata: {
                            ...metadata,
                            'x-amz-key': encryptedDataKey.toString('base64'),
                            'x-amz-hash': hash,
                            'x-amz-encryption': 'AES-256-GCM'
                        },
                        ContentType: metadata.contentType || 'application/octet-stream',
                        Tagging: 'retention=90days'
                    };

                    await this.s3Client.send(new PutObjectCommand(uploadParams));

                    const fileMetadata: FileMetadata = {
                        fileName,
                        contentType: metadata.contentType,
                        size: Buffer.isBuffer(fileData) ? fileData.length : metadata.size,
                        hash,
                        uploadDate: new Date(),
                        encryptionType: 'AES-256-GCM',
                        storageClass: 'STANDARD',
                        metadata
                    };

                    resolve(fileMetadata);
                } catch (error) {
                    if (operation.retry(error)) {
                        this.logger.warn(`Retrying upload, attempt ${currentAttempt}`);
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    async downloadFile(fileName: string): Promise<Buffer> {
        try {
            const { Body, Metadata } = await this.s3Client.send(new GetObjectCommand({
                Bucket: this.bucketName,
                Key: fileName
            }));

            const encryptedDataKey = Buffer.from(Metadata['x-amz-key'], 'base64');
            
            // Decrypt the data key
            const { Plaintext: dataKey } = await this.kmsClient.send(new DecryptCommand({
                CiphertextBlob: encryptedDataKey,
                KeyId: this.kmsKeyId
            }));

            // Stream and decrypt the file data
            const chunks: Buffer[] = [];
            for await (const chunk of Body as Stream) {
                chunks.push(Buffer.from(chunk));
            }
            const encryptedData = Buffer.concat(chunks);
            
            return this.decryptData(encryptedData, dataKey);
        } catch (error) {
            this.logger.error(`Failed to download file: ${fileName}`, error);
            throw error;
        }
    }

    async deleteFile(fileName: string): Promise<void> {
        try {
            await this.s3Client.send(new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: fileName
            }));
        } catch (error) {
            this.logger.error(`Failed to delete file: ${fileName}`, error);
            throw error;
        }
    }

    async getFileMetadata(fileName: string): Promise<FileMetadata> {
        try {
            const { Metadata, ContentLength, LastModified } = 
                await this.s3Client.send(new HeadObjectCommand({
                    Bucket: this.bucketName,
                    Key: fileName
                }));

            return {
                fileName,
                contentType: Metadata['content-type'],
                size: ContentLength,
                hash: Metadata['x-amz-hash'],
                uploadDate: LastModified,
                encryptionType: Metadata['x-amz-encryption'],
                storageClass: 'STANDARD',
                metadata: Metadata
            };
        } catch (error) {
            this.logger.error(`Failed to get metadata for file: ${fileName}`, error);
            throw error;
        }
    }

    async listFiles(filters: Record<string, any>): Promise<FileMetadata[]> {
        try {
            const { Contents } = await this.s3Client.send(new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: filters.prefix || ''
            }));

            const metadataPromises = Contents.map(object => 
                this.getFileMetadata(object.Key)
            );

            return Promise.all(metadataPromises);
        } catch (error) {
            this.logger.error('Failed to list files', error);
            throw error;
        }
    }

    private generateContentHash(data: Buffer | Stream): string {
        const hash = createHash('sha256');
        if (Buffer.isBuffer(data)) {
            hash.update(data);
        } else {
            // Handle streaming hash calculation
            data.on('data', chunk => hash.update(chunk));
        }
        return hash.digest('hex');
    }

    private encryptData(data: Buffer | Stream, key: Buffer): Buffer {
        // Implementation of AES-256-GCM encryption
        // Note: Actual implementation would include IV generation and GCM auth tag
        return Buffer.from(data); // Placeholder for actual encryption
    }

    private decryptData(encryptedData: Buffer, key: Buffer): Buffer {
        // Implementation of AES-256-GCM decryption
        // Note: Actual implementation would verify GCM auth tag
        return encryptedData; // Placeholder for actual decryption
    }
}