import Foundation
import Security
import LocalAuthentication

// MARK: - Constants
private let kKeychainService = "com.babycryanalyzer.keychain"
private let kAccessGroup = "com.babycryanalyzer.shared"
private let kKeyRotationInterval: TimeInterval = 2592000 // 30 days

// MARK: - KeychainError
@frozen public enum KeychainError: Error {
    case itemNotFound
    case duplicateItem
    case invalidItemFormat
    case unexpectedStatus(OSStatus)
    case authenticationFailed
    case biometricNotAvailable
    case jailbreakDetected
    case encryptionError
    case keyRotationFailed
    
    var errorDescription: String {
        switch self {
        case .itemNotFound: return "Requested item not found in Keychain"
        case .duplicateItem: return "Item already exists in Keychain"
        case .invalidItemFormat: return "Invalid item format"
        case .unexpectedStatus(let status): return "Unexpected Keychain status: \(status)"
        case .authenticationFailed: return "Biometric authentication failed"
        case .biometricNotAvailable: return "Biometric authentication not available"
        case .jailbreakDetected: return "Device security compromised"
        case .encryptionError: return "Encryption operation failed"
        case .keyRotationFailed: return "Key rotation failed"
        }
    }
}

// MARK: - KeychainManager
public final class KeychainManager {
    
    // MARK: - Properties
    private static let shared = KeychainManager()
    private let queue: DispatchQueue
    private var encryptionKey: Data
    private var lastKeyRotation: Date
    private let authContext: LAContext
    
    // MARK: - Initialization
    private init() {
        self.queue = DispatchQueue(label: "com.babycryanalyzer.keychain", qos: .userInitiated)
        self.authContext = LAContext()
        
        // Generate initial encryption key
        guard case .success(let key) = SecurityUtils.generateEncryptionKey(purpose: "KeychainEncryption") else {
            fatalError("Failed to initialize KeychainManager encryption key")
        }
        self.encryptionKey = key
        self.lastKeyRotation = Date()
        
        // Configure biometric authentication
        authContext.localizedCancelTitle = "Cancel Authentication"
        authContext.localizedFallbackTitle = "Use Passcode"
    }
    
    // MARK: - Public Interface
    
    /// Shared instance accessor
    public static var standard: KeychainManager {
        return shared
    }
    
    /// Saves encrypted data to Keychain
    /// - Parameters:
    ///   - data: Data to be stored
    ///   - key: Unique identifier for the data
    ///   - requiresBiometric: Whether biometric authentication is required for access
    /// - Returns: Result indicating success or detailed error
    public func saveItem(_ data: Data, forKey key: String, requiresBiometric: Bool = false) -> Result<Void, KeychainError> {
        return queue.sync {
            // Check for jailbreak
            if isJailbroken() {
                NSLog("[SECURITY_ALERT] Jailbreak detected during save operation")
                return .failure(.jailbreakDetected)
            }
            
            // Perform key rotation if needed
            if shouldRotateKey() {
                guard case .success = rotateEncryptionKey() else {
                    return .failure(.keyRotationFailed)
                }
            }
            
            // Encrypt data
            guard case .success(let encryptedData) = SecurityUtils.encryptSensitiveData(
                data: data,
                key: encryptionKey,
                purpose: "KeychainStorage"
            ) else {
                return .failure(.encryptionError)
            }
            
            // Configure Keychain query
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: kKeychainService,
                kSecAttrAccount as String: key,
                kSecValueData as String: encryptedData,
                kSecAttrAccessGroup as String: kAccessGroup,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
            ]
            
            // Add biometric protection if required
            if requiresBiometric {
                guard authContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
                    return .failure(.biometricNotAvailable)
                }
                
                let accessControl = SecAccessControlCreateWithFlags(
                    nil,
                    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
                    .biometryAny,
                    nil
                )
                query[kSecAttrAccessControl as String] = accessControl
            }
            
            // Attempt to save to Keychain
            let status = SecItemAdd(query as CFDictionary, nil)
            
            switch status {
            case errSecSuccess:
                NSLog("[SECURITY_AUDIT] Successfully saved item for key: \(key)")
                return .success(())
            case errSecDuplicateItem:
                // Update existing item
                let updateQuery: [String: Any] = [
                    kSecValueData as String: encryptedData
                ]
                let updateStatus = SecItemUpdate(query as CFDictionary, updateQuery as CFDictionary)
                guard updateStatus == errSecSuccess else {
                    return .failure(.unexpectedStatus(updateStatus))
                }
                NSLog("[SECURITY_AUDIT] Successfully updated item for key: \(key)")
                return .success(())
            default:
                return .failure(.unexpectedStatus(status))
            }
        }
    }
    
    /// Retrieves and decrypts data from Keychain
    /// - Parameters:
    ///   - key: Unique identifier for the data
    ///   - requiresBiometric: Whether biometric authentication is required
    /// - Returns: Result containing decrypted data or detailed error
    public func loadItem(forKey key: String, requiresBiometric: Bool = false) -> Result<Data?, KeychainError> {
        return queue.sync {
            // Check for jailbreak
            if isJailbroken() {
                NSLog("[SECURITY_ALERT] Jailbreak detected during load operation")
                return .failure(.jailbreakDetected)
            }
            
            // Handle biometric authentication if required
            if requiresBiometric {
                guard authContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
                    return .failure(.biometricNotAvailable)
                }
                
                var authError: NSError?
                let authenticated = authContext.evaluatePolicy(
                    .deviceOwnerAuthenticationWithBiometrics,
                    localizedReason: "Authentication required to access secure data",
                    error: &authError
                )
                
                guard authenticated else {
                    NSLog("[SECURITY_AUDIT] Biometric authentication failed")
                    return .failure(.authenticationFailed)
                }
            }
            
            // Configure Keychain query
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: kKeychainService,
                kSecAttrAccount as String: key,
                kSecReturnData as String: true,
                kSecAttrAccessGroup as String: kAccessGroup,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]
            
            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            
            guard status == errSecSuccess else {
                return status == errSecItemNotFound ? .success(nil) : .failure(.unexpectedStatus(status))
            }
            
            guard let encryptedData = result as? Data else {
                return .failure(.invalidItemFormat)
            }
            
            // Decrypt data
            guard case .success(let decryptedData) = SecurityUtils.decryptSensitiveData(
                encryptedData: encryptedData,
                key: encryptionKey,
                purpose: "KeychainRetrieval"
            ) else {
                return .failure(.encryptionError)
            }
            
            NSLog("[SECURITY_AUDIT] Successfully loaded item for key: \(key)")
            return .success(decryptedData)
        }
    }
    
    // MARK: - Private Helpers
    
    private func rotateEncryptionKey() -> Result<Void, KeychainError> {
        guard case .success(let newKey) = SecurityUtils.rotateEncryptionKey(
            oldKey: encryptionKey,
            purpose: "KeychainKeyRotation"
        ) else {
            return .failure(.keyRotationFailed)
        }
        
        encryptionKey = newKey
        lastKeyRotation = Date()
        NSLog("[SECURITY_AUDIT] Successfully rotated encryption key")
        return .success(())
    }
    
    private func shouldRotateKey() -> Bool {
        return Date().timeIntervalSince(lastKeyRotation) >= kKeyRotationInterval
    }
    
    private func isJailbroken() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        let paths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt/"
        ]
        
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }
        
        return false
        #endif
    }
}