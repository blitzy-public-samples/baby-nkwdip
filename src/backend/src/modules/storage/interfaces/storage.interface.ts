import { Stream } from 'stream'; // Node.js stream type definitions for file handling

/**
 * Comprehensive interface describing metadata for stored files including security 
 * and management information
 */
export interface FileMetadata {
    /** Name of the stored file */
    fileName: string;

    /** MIME type of the file content */
    contentType: string;

    /** Size of the file in bytes */
    size: number;

    /** Cryptographic hash of file contents for integrity verification */
    hash: string;

    /** Timestamp when the file was uploaded */
    uploadDate: Date;

    /** Type of encryption used (e.g., 'AES-256') */
    encryptionType: string;

    /** AWS S3 storage class (e.g., 'STANDARD', 'GLACIER') */
    storageClass: string;

    /** Additional custom metadata for the file */
    metadata: Record<string, any>;
}

/**
 * Core interface defining storage service operations with support for secure file 
 * handling and streaming
 */
export interface StorageService {
    /**
     * Uploads a file to storage with metadata and encryption
     * @param fileData - File contents as Buffer or Stream
     * @param fileName - Name to store the file under
     * @param metadata - Additional metadata for the file
     * @returns Promise resolving to uploaded file metadata
     * @throws StorageError if upload fails
     */
    uploadFile(
        fileData: Buffer | Stream,
        fileName: string,
        metadata: Record<string, any>
    ): Promise<FileMetadata>;

    /**
     * Downloads and decrypts a file from storage
     * @param fileName - Name of file to download
     * @returns Promise resolving to decrypted file contents
     * @throws StorageError if file not found or decryption fails
     */
    downloadFile(fileName: string): Promise<Buffer>;

    /**
     * Securely deletes a file from storage
     * @param fileName - Name of file to delete
     * @returns Promise resolving when deletion is complete
     * @throws StorageError if deletion fails
     */
    deleteFile(fileName: string): Promise<void>;

    /**
     * Retrieves comprehensive metadata for a stored file
     * @param fileName - Name of file to get metadata for
     * @returns Promise resolving to file metadata
     * @throws StorageError if file not found
     */
    getFileMetadata(fileName: string): Promise<FileMetadata>;

    /**
     * Lists files with optional filtering by metadata
     * @param filters - Optional metadata filters to apply
     * @returns Promise resolving to array of matching file metadata
     * @throws StorageError if listing operation fails
     */
    listFiles(filters: Record<string, any>): Promise<FileMetadata[]>;
}