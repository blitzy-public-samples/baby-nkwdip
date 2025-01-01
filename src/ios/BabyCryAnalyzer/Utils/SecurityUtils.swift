import Foundation
import CommonCrypto
import Security

// MARK: - Constants
private let kSecurityLevel = kSecAttrAccessibleAfterFirstUnlock
private let kEncryptionAlgorithm = kSecKeyAlgorithmRSAEncryptionOAEPSHA256
private let kKeySize: Int = 256
private let kKeyRotationInterval: TimeInterval = 2592000 // 30 days
private let kPBKDF2Iterations: Int = 10000

// MARK: - SecurityError
@frozen public enum SecurityError: Error {
    case invalidInput
    case keyGenerationFailed
    case encryptionFailed
    case decryptionFailed
    case keyRotationFailed
    case keyExpired
    case validationFailed
    
    var errorDescription: String {
        switch self {
        case .invalidInput: return "Invalid input parameters provided"
        case .keyGenerationFailed: return "Failed to generate encryption key"
        case .encryptionFailed: return "Data encryption failed"
        case .decryptionFailed: return "Data decryption failed"
        case .keyRotationFailed: return "Key rotation operation failed"
        case .keyExpired: return "Encryption key has expired"
        case .validationFailed: return "Data validation failed"
        }
    }
    
    var errorCode: String {
        switch self {
        case .invalidInput: return "SEC_001"
        case .keyGenerationFailed: return "SEC_002"
        case .encryptionFailed: return "SEC_003"
        case .decryptionFailed: return "SEC_004"
        case .keyRotationFailed: return "SEC_005"
        case .keyExpired: return "SEC_006"
        case .validationFailed: return "SEC_007"
        }
    }
    
    var timestamp: Date {
        return Date()
    }
    
    func logError() {
        let errorLog = """
        Security Error:
        Code: \(errorCode)
        Description: \(errorDescription)
        Timestamp: \(timestamp)
        """
        NSLog("[SECURITY_ERROR] \(errorLog)")
        
        // TODO: Implement additional error reporting/alerting as needed
    }
}

// MARK: - SecurityUtils
public final class SecurityUtils {
    
    // MARK: - Key Generation
    
    /// Generates a cryptographically secure random encryption key
    /// - Parameters:
    ///   - purpose: Description of key's intended use
    ///   - expirationDate: Optional expiration date for key rotation
    /// - Returns: Result containing generated key or error
    public static func generateEncryptionKey(
        purpose: String,
        expirationDate: Date? = Date(timeIntervalSinceNow: kKeyRotationInterval)
    ) -> Result<Data, SecurityError> {
        guard !purpose.isEmpty else {
            let error = SecurityError.invalidInput
            error.logError()
            return .failure(error)
        }
        
        var keyData = Data(count: kKeySize / 8)
        let result = keyData.withUnsafeMutableBytes { keyBytes in
            SecRandomCopyBytes(kSecRandomDefault, keyData.count, keyBytes.baseAddress!)
        }
        
        guard result == errSecSuccess else {
            let error = SecurityError.keyGenerationFailed
            error.logError()
            return .failure(error)
        }
        
        // Log key generation
        NSLog("[SECURITY_AUDIT] Generated new encryption key for purpose: \(purpose)")
        
        // Schedule key rotation if expiration provided
        if let expirationDate = expirationDate {
            scheduleKeyRotation(purpose: purpose, expirationDate: expirationDate)
        }
        
        return .success(keyData)
    }
    
    // MARK: - Encryption
    
    /// Encrypts sensitive data using AES-256 encryption
    /// - Parameters:
    ///   - data: Data to encrypt
    ///   - key: Encryption key
    ///   - purpose: Description of encryption purpose
    /// - Returns: Result containing encrypted data or error
    public static func encryptSensitiveData(
        data: Data,
        key: Data,
        purpose: String
    ) -> Result<Data, SecurityError> {
        guard !data.isEmpty, !purpose.isEmpty else {
            let error = SecurityError.invalidInput
            error.logError()
            return .failure(error)
        }
        
        // Log encryption attempt
        NSLog("[SECURITY_AUDIT] Attempting encryption for purpose: \(purpose)")
        
        // Perform encryption using Data extension
        guard let encryptedData = data.encrypt(with: key) else {
            let error = SecurityError.encryptionFailed
            error.logError()
            return .failure(error)
        }
        
        // Log successful encryption
        NSLog("[SECURITY_AUDIT] Successfully encrypted data for purpose: \(purpose)")
        
        return .success(encryptedData)
    }
    
    // MARK: - Decryption
    
    /// Decrypts AES-256 encrypted data
    /// - Parameters:
    ///   - encryptedData: Data to decrypt
    ///   - key: Decryption key
    ///   - purpose: Description of decryption purpose
    /// - Returns: Result containing decrypted data or error
    public static func decryptSensitiveData(
        encryptedData: Data,
        key: Data,
        purpose: String
    ) -> Result<Data, SecurityError> {
        guard !encryptedData.isEmpty, !purpose.isEmpty else {
            let error = SecurityError.invalidInput
            error.logError()
            return .failure(error)
        }
        
        // Log decryption attempt
        NSLog("[SECURITY_AUDIT] Attempting decryption for purpose: \(purpose)")
        
        // Perform decryption using Data extension
        guard let decryptedData = encryptedData.decrypt(with: key) else {
            let error = SecurityError.decryptionFailed
            error.logError()
            return .failure(error)
        }
        
        // Log successful decryption
        NSLog("[SECURITY_AUDIT] Successfully decrypted data for purpose: \(purpose)")
        
        return .success(decryptedData)
    }
    
    // MARK: - Key Rotation
    
    /// Performs secure key rotation
    /// - Parameters:
    ///   - oldKey: Current encryption key
    ///   - purpose: Description of key's purpose
    /// - Returns: Result containing new encryption key or error
    public static func rotateEncryptionKey(
        oldKey: Data,
        purpose: String
    ) -> Result<Data, SecurityError> {
        guard !oldKey.isEmpty, !purpose.isEmpty else {
            let error = SecurityError.invalidInput
            error.logError()
            return .failure(error)
        }
        
        // Generate new key
        let newKeyResult = generateEncryptionKey(purpose: purpose)
        guard case .success(let newKey) = newKeyResult else {
            let error = SecurityError.keyRotationFailed
            error.logError()
            return .failure(error)
        }
        
        // Log key rotation
        NSLog("[SECURITY_AUDIT] Performed key rotation for purpose: \(purpose)")
        
        // Securely erase old key from memory
        oldKey.withUnsafeBytes { ptr in
            memset_s(UnsafeMutableRawPointer(mutating: ptr.baseAddress!),
                    ptr.count,
                    0,
                    ptr.count)
        }
        
        return .success(newKey)
    }
    
    // MARK: - Private Helpers
    
    private static func scheduleKeyRotation(purpose: String, expirationDate: Date) {
        let rotationTimer = Timer(fire: expirationDate, interval: 0, repeats: false) { _ in
            NSLog("[SECURITY_AUDIT] Key rotation scheduled for purpose: \(purpose)")
            // Implement key rotation notification/callback mechanism
        }
        RunLoop.main.add(rotationTimer, forMode: .common)
    }
}