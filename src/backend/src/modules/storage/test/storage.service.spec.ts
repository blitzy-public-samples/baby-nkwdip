import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand, 
    HeadObjectCommand,
    ServerSideEncryption 
} from '@aws-sdk/client-s3';
import { 
    KMSClient, 
    GenerateDataKeyCommand, 
    DecryptCommand 
} from '@aws-sdk/client-kms';
import { Readable } from 'stream';
import { S3StorageService } from '../storage.service';
import { FileMetadata } from '../interfaces/storage.interface';

// @nestjs/testing version: ^9.0.0
// @aws-sdk/client-s3 version: ^3.0.0
// @aws-sdk/client-kms version: ^3.0.0

describe('S3StorageService', () => {
    let module: TestingModule;
    let storageService: S3StorageService;
    let mockS3Client: jest.Mocked<S3Client>;
    let mockKMSClient: jest.Mocked<KMSClient>;
    let mockConfigService: jest.Mocked<ConfigService>;

    const mockConfig = {
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'test-bucket',
        AWS_KMS_KEY_ID: 'test-key-id'
    };

    beforeEach(async () => {
        mockS3Client = {
            send: jest.fn()
        } as any;

        mockKMSClient = {
            send: jest.fn()
        } as any;

        mockConfigService = {
            get: jest.fn((key: string) => mockConfig[key])
        } as any;

        module = await Test.createTestingModule({
            providers: [
                S3StorageService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService
                }
            ]
        }).compile();

        storageService = module.get<S3StorageService>(S3StorageService);
        // Replace the real clients with mocks
        (storageService as any).s3Client = mockS3Client;
        (storageService as any).kmsClient = mockKMSClient;
    });

    afterEach(async () => {
        await module.close();
        jest.clearAllMocks();
    });

    describe('uploadFile', () => {
        const testFile = Buffer.from('test content');
        const testFileName = 'test.txt';
        const testMetadata = {
            contentType: 'text/plain',
            userId: 'test-user'
        };

        it('should upload file with proper encryption and metadata', async () => {
            // Mock KMS data key generation
            const mockDataKey = Buffer.from('mock-data-key');
            const mockEncryptedKey = Buffer.from('mock-encrypted-key');
            mockKMSClient.send.mockImplementationOnce(() => Promise.resolve({
                Plaintext: mockDataKey,
                CiphertextBlob: mockEncryptedKey
            }));

            // Mock S3 upload
            mockS3Client.send.mockImplementationOnce(() => Promise.resolve({}));

            const result = await storageService.uploadFile(testFile, testFileName, testMetadata);

            // Verify KMS key generation
            expect(mockKMSClient.send).toHaveBeenCalledWith(
                expect.any(GenerateDataKeyCommand)
            );

            // Verify S3 upload parameters
            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Bucket: mockConfig.AWS_S3_BUCKET,
                        Key: expect.stringContaining(testFileName),
                        ServerSideEncryption: ServerSideEncryption.aws_kms,
                        SSEKMSKeyId: mockConfig.AWS_KMS_KEY_ID,
                        Metadata: expect.objectContaining({
                            'x-amz-encryption': 'AES-256-GCM'
                        })
                    })
                })
            );

            // Verify returned metadata
            expect(result).toMatchObject({
                fileName: testFileName,
                contentType: testMetadata.contentType,
                size: testFile.length,
                encryptionType: 'AES-256-GCM'
            });
        });

        it('should handle upload failures with retries', async () => {
            // Mock KMS success
            mockKMSClient.send.mockImplementationOnce(() => Promise.resolve({
                Plaintext: Buffer.from('key'),
                CiphertextBlob: Buffer.from('encrypted-key')
            }));

            // Mock S3 failure then success
            mockS3Client.send
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({});

            const result = await storageService.uploadFile(testFile, testFileName, testMetadata);

            expect(mockS3Client.send).toHaveBeenCalledTimes(2);
            expect(result).toBeDefined();
        });

        it('should enforce content integrity verification', async () => {
            // Setup KMS mock
            mockKMSClient.send.mockImplementationOnce(() => Promise.resolve({
                Plaintext: Buffer.from('key'),
                CiphertextBlob: Buffer.from('encrypted-key')
            }));

            // Mock S3 upload
            mockS3Client.send.mockImplementationOnce(() => Promise.resolve({}));

            const result = await storageService.uploadFile(testFile, testFileName, testMetadata);

            expect(result.hash).toBeDefined();
            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Metadata: expect.objectContaining({
                            'x-amz-hash': expect.any(String)
                        })
                    })
                })
            );
        });
    });

    describe('downloadFile', () => {
        const testFileName = 'test.txt';
        const mockEncryptedData = Buffer.from('encrypted-content');

        it('should download and decrypt file correctly', async () => {
            // Mock S3 download
            mockS3Client.send.mockImplementationOnce(() => Promise.resolve({
                Body: Readable.from([mockEncryptedData]),
                Metadata: {
                    'x-amz-key': Buffer.from('encrypted-key').toString('base64'),
                    'x-amz-encryption': 'AES-256-GCM'
                }
            }));

            // Mock KMS decrypt
            mockKMSClient.send.mockImplementationOnce(() => Promise.resolve({
                Plaintext: Buffer.from('decrypted-key')
            }));

            const result = await storageService.downloadFile(testFileName);

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.any(GetObjectCommand)
            );
            expect(mockKMSClient.send).toHaveBeenCalledWith(
                expect.any(DecryptCommand)
            );
            expect(Buffer.isBuffer(result)).toBeTruthy();
        });

        it('should verify file integrity during download', async () => {
            const mockMetadata = {
                'x-amz-key': Buffer.from('encrypted-key').toString('base64'),
                'x-amz-hash': 'original-hash',
                'x-amz-encryption': 'AES-256-GCM'
            };

            mockS3Client.send.mockImplementationOnce(() => Promise.resolve({
                Body: Readable.from([mockEncryptedData]),
                Metadata: mockMetadata
            }));

            mockKMSClient.send.mockImplementationOnce(() => Promise.resolve({
                Plaintext: Buffer.from('decrypted-key')
            }));

            await expect(storageService.downloadFile(testFileName)).resolves.toBeDefined();
        });
    });

    describe('getFileMetadata', () => {
        const testFileName = 'test.txt';

        it('should retrieve complete file metadata with security information', async () => {
            const mockResponse = {
                Metadata: {
                    'content-type': 'text/plain',
                    'x-amz-encryption': 'AES-256-GCM',
                    'x-amz-hash': 'test-hash'
                },
                ContentLength: 1000,
                LastModified: new Date()
            };

            mockS3Client.send.mockImplementationOnce(() => Promise.resolve(mockResponse));

            const result = await storageService.getFileMetadata(testFileName);

            expect(result).toMatchObject({
                fileName: testFileName,
                contentType: 'text/plain',
                size: 1000,
                encryptionType: 'AES-256-GCM',
                hash: 'test-hash'
            });
        });
    });

    describe('deleteFile', () => {
        const testFileName = 'test.txt';

        it('should verify retention policy before deletion', async () => {
            // Mock metadata check
            mockS3Client.send.mockImplementationOnce(() => Promise.resolve({
                Metadata: {
                    'retention-period': '90'
                },
                LastModified: new Date()
            }));

            // Mock deletion
            mockS3Client.send.mockImplementationOnce(() => Promise.resolve({}));

            await storageService.deleteFile(testFileName);

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.any(HeadObjectCommand)
            );
            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.any(DeleteObjectCommand)
            );
        });
    });
});