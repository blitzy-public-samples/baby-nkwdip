// External imports with versions
import * as crypto from 'crypto'; // Node.js native
import * as path from 'path'; // Node.js native
import * as fs from 'fs/promises'; // Node.js native
import * as mime from 'mime-types'; // ^2.1.35

// Constants for file handling
export const ALLOWED_AUDIO_TYPES = [
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/x-wav',
    'audio/webm'
] as const;

export const MAX_AUDIO_SIZE = 10485760; // 10MB
export const HASH_ALGORITHM = 'sha256';
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const MAX_FILENAME_LENGTH = 1024;
export const STORAGE_CLASSES = [
    'STANDARD',
    'STANDARD_IA',
    'INTELLIGENT_TIERING'
] as const;

// Interface definitions
export interface FileMetadata {
    name: string;
    mimeType: string;
    size: number;
    hash: string;
    encryptionKey: string;
    partitionKey: string;
    createdAt: Date;
    updatedAt: Date;
    storageClass: typeof STORAGE_CLASSES[number];
    tags: Record<string, string>;
}

export interface FileValidationOptions {
    maxSize: number;
    allowedTypes: string[];
    requireHash: boolean;
    requireEncryption: boolean;
    requiredTags: string[];
    maxNameLength: number;
}

/**
 * Generates a secure SHA-256 hash of file contents using streaming for memory efficiency
 * @param fileData - File data as Buffer or ReadableStream
 * @returns Promise resolving to hexadecimal hash string
 */
export async function generateFileHash(
    fileData: Buffer | NodeJS.ReadableStream
): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(HASH_ALGORITHM);
        
        if (Buffer.isBuffer(fileData)) {
            hash.update(fileData);
            resolve(hash.digest('hex'));
        } else {
            fileData.on('data', chunk => hash.update(chunk));
            fileData.on('end', () => resolve(hash.digest('hex')));
            fileData.on('error', error => reject(error));
        }
    });
}

/**
 * Extracts and validates comprehensive file metadata with encryption support
 * @param fileData - File data as Buffer or ReadableStream
 * @param fileName - Original file name
 * @param enableEncryption - Flag to enable encryption
 * @returns Promise resolving to FileMetadata object
 */
export async function getFileMetadata(
    fileData: Buffer | NodeJS.ReadableStream,
    fileName: string,
    enableEncryption: boolean
): Promise<FileMetadata> {
    const now = new Date();
    const mimeType = mime.lookup(fileName) || 'application/octet-stream';
    const size = Buffer.isBuffer(fileData) ? fileData.length : 0; // Stream size calculation requires consumption
    
    // Generate encryption key if enabled
    const encryptionKey = enableEncryption 
        ? crypto.randomBytes(32).toString('hex')
        : '';

    // Generate partition key based on timestamp (YYYY/MM/DD)
    const partitionKey = now.toISOString().split('T')[0].replace(/-/g, '/');

    const metadata: FileMetadata = {
        name: fileName,
        mimeType,
        size,
        hash: await generateFileHash(fileData),
        encryptionKey,
        partitionKey,
        createdAt: now,
        updatedAt: now,
        storageClass: 'STANDARD',
        tags: {
            uploadedAt: now.toISOString(),
            encrypted: String(enableEncryption)
        }
    };

    return metadata;
}

/**
 * Performs comprehensive file validation including security checks
 * @param metadata - File metadata object
 * @param options - Validation options
 * @returns Promise resolving to validation result with errors
 */
export async function validateFile(
    metadata: FileMetadata,
    options: FileValidationOptions
): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Size validation
    if (metadata.size > options.maxSize) {
        errors.push(`File size ${metadata.size} exceeds maximum allowed size ${options.maxSize}`);
    }

    // MIME type validation
    if (!options.allowedTypes.includes(metadata.mimeType)) {
        errors.push(`File type ${metadata.mimeType} not allowed`);
    }

    // Hash validation
    if (options.requireHash && !metadata.hash) {
        errors.push('File hash is required but missing');
    }

    // Encryption validation
    if (options.requireEncryption && !metadata.encryptionKey) {
        errors.push('File encryption is required but not enabled');
    }

    // Required tags validation
    for (const tag of options.requiredTags) {
        if (!metadata.tags[tag]) {
            errors.push(`Required tag "${tag}" is missing`);
        }
    }

    // Name length validation
    if (metadata.name.length > options.maxNameLength) {
        errors.push(`File name exceeds maximum length of ${options.maxNameLength} characters`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitizes file name for secure S3 storage with collision prevention
 * @param fileName - Original file name
 * @param preserveExtension - Flag to preserve file extension
 * @returns Sanitized file name
 */
export function sanitizeFileName(
    fileName: string,
    preserveExtension = true
): string {
    // Extract extension if preservation is requested
    const ext = preserveExtension ? path.extname(fileName) : '';
    const baseFileName = path.basename(fileName, ext);

    // Remove unsafe characters and spaces
    let sanitized = baseFileName
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();

    // Add timestamp for uniqueness
    const timestamp = Date.now();
    sanitized = `${timestamp}-${sanitized}`;

    // Ensure maximum length compliance (accounting for extension)
    const maxBaseLength = MAX_FILENAME_LENGTH - ext.length;
    if (sanitized.length > maxBaseLength) {
        sanitized = sanitized.substring(0, maxBaseLength);
    }

    // Reattach extension if preserved
    return `${sanitized}${ext}`;
}