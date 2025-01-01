import Foundation
import CommonCrypto

// MARK: - Constants
private let kAESBlockSize: UInt8 = 16
private let kAESKeySize: UInt8 = 32
private let kIVSize: UInt8 = 16
private let kCompressionBufferSize: UInt32 = 1024 * 1024 // 1MB buffer for streaming compression

// MARK: - Data Extension
extension Data {
    
    // MARK: - Encryption
    
    /// Encrypts data using AES-256-CBC encryption with a random IV
    /// - Parameter key: 32-byte encryption key
    /// - Returns: Encrypted data with IV prepended, or nil if encryption fails
    @inlinable
    public func encrypt(with key: Data) -> Data? {
        // Validate key size
        guard key.count == Int(kAESKeySize) else {
            return nil
        }
        
        // Generate random IV
        var iv = Data(count: Int(kIVSize))
        let result = iv.withUnsafeMutableBytes { ivBytes in
            SecRandomCopyBytes(kSecRandomDefault, kIVSize, ivBytes.baseAddress!)
        }
        guard result == errSecSuccess else {
            return nil
        }
        
        // Prepare for encryption
        let dataLength = self.count
        let bufferSize = size_t(dataLength + kCCBlockSizeAES128)
        var buffer = Data(count: bufferSize)
        
        var numBytesEncrypted: size_t = 0
        
        // Perform encryption
        let cryptStatus = buffer.withUnsafeMutableBytes { bufferBytes in
            self.withUnsafeBytes { dataBytes in
                key.withUnsafeBytes { keyBytes in
                    iv.withUnsafeBytes { ivBytes in
                        CCCrypt(
                            CCOperation(kCCEncrypt),
                            CCAlgorithm(kCCAlgorithmAES),
                            CCOptions(kCCOptionPKCS7Padding),
                            keyBytes.baseAddress,
                            key.count,
                            ivBytes.baseAddress,
                            dataBytes.baseAddress,
                            dataLength,
                            bufferBytes.baseAddress,
                            bufferSize,
                            &numBytesEncrypted
                        )
                    }
                }
            }
        }
        
        guard cryptStatus == kCCSuccess else {
            return nil
        }
        
        buffer.count = numBytesEncrypted
        
        // Prepend IV to encrypted data
        return iv + buffer
    }
    
    /// Decrypts AES-256-CBC encrypted data
    /// - Parameter key: 32-byte decryption key
    /// - Returns: Decrypted data or nil if decryption fails
    @inlinable
    public func decrypt(with key: Data) -> Data? {
        // Validate minimum data length (IV + at least one block)
        guard self.count >= Int(kIVSize + kAESBlockSize) else {
            return nil
        }
        
        // Validate key size
        guard key.count == Int(kAESKeySize) else {
            return nil
        }
        
        // Extract IV and encrypted data
        let iv = self.prefix(Int(kIVSize))
        let encryptedData = self.suffix(from: Int(kIVSize))
        
        let dataLength = encryptedData.count
        let bufferSize = size_t(dataLength + kCCBlockSizeAES128)
        var buffer = Data(count: bufferSize)
        
        var numBytesDecrypted: size_t = 0
        
        // Perform decryption
        let cryptStatus = buffer.withUnsafeMutableBytes { bufferBytes in
            encryptedData.withUnsafeBytes { dataBytes in
                key.withUnsafeBytes { keyBytes in
                    iv.withUnsafeBytes { ivBytes in
                        CCCrypt(
                            CCOperation(kCCDecrypt),
                            CCAlgorithm(kCCAlgorithmAES),
                            CCOptions(kCCOptionPKCS7Padding),
                            keyBytes.baseAddress,
                            key.count,
                            ivBytes.baseAddress,
                            dataBytes.baseAddress,
                            dataLength,
                            bufferBytes.baseAddress,
                            bufferSize,
                            &numBytesDecrypted
                        )
                    }
                }
            }
        }
        
        guard cryptStatus == kCCSuccess else {
            return nil
        }
        
        buffer.count = numBytesDecrypted
        return buffer
    }
    
    // MARK: - Compression
    
    /// Compresses data using zlib compression
    /// - Parameter level: Compression level (0-9, default: -1 for default compression)
    /// - Returns: Compressed data or nil if compression fails
    public func compress(level: Int32 = -1) -> Data? {
        guard !self.isEmpty else {
            return nil
        }
        
        var stream = z_stream()
        var status: Int32
        
        status = deflateInit_(&stream, level, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
        guard status == Z_OK else {
            return nil
        }
        
        var compressed = Data()
        var buffer = Data(count: Int(kCompressionBufferSize))
        
        // Set up the input
        stream.next_in = (self as NSData).bytes.bindMemory(to: UInt8.self, capacity: self.count)
        stream.avail_in = UInt32(self.count)
        
        // Compress in chunks
        repeat {
            stream.next_out = buffer.withUnsafeMutableBytes { $0.baseAddress?.bindMemory(to: UInt8.self, capacity: buffer.count) }
            stream.avail_out = UInt32(buffer.count)
            
            status = deflate(&stream, Z_FINISH)
            
            guard status >= Z_OK else {
                deflateEnd(&stream)
                return nil
            }
            
            let count = buffer.count - Int(stream.avail_out)
            compressed.append(buffer.prefix(count))
            
        } while stream.avail_out == 0
        
        deflateEnd(&stream)
        return compressed
    }
    
    /// Decompresses zlib compressed data
    /// - Returns: Decompressed data or nil if decompression fails
    public func decompress() -> Data? {
        guard !self.isEmpty else {
            return nil
        }
        
        var stream = z_stream()
        var status: Int32
        
        status = inflateInit_(&stream, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
        guard status == Z_OK else {
            return nil
        }
        
        var decompressed = Data()
        var buffer = Data(count: Int(kCompressionBufferSize))
        
        // Set up the input
        stream.next_in = (self as NSData).bytes.bindMemory(to: UInt8.self, capacity: self.count)
        stream.avail_in = UInt32(self.count)
        
        // Decompress in chunks
        repeat {
            stream.next_out = buffer.withUnsafeMutableBytes { $0.baseAddress?.bindMemory(to: UInt8.self, capacity: buffer.count) }
            stream.avail_out = UInt32(buffer.count)
            
            status = inflate(&stream, Z_NO_FLUSH)
            
            guard status != Z_NEED_DICT && status != Z_DATA_ERROR && status != Z_MEM_ERROR else {
                inflateEnd(&stream)
                return nil
            }
            
            let count = buffer.count - Int(stream.avail_out)
            decompressed.append(buffer.prefix(count))
            
        } while status != Z_STREAM_END
        
        inflateEnd(&stream)
        return decompressed
    }
    
    // MARK: - Utilities
    
    /// Converts data to hexadecimal string representation
    /// - Returns: Hexadecimal string representation of data
    public func toHexString() -> String {
        return self.map { String(format: "%02x", $0) }.joined()
    }
}