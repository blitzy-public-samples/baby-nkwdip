import Foundation
import React
import LocalAuthentication

// MARK: - Constants
private let kModuleName = "SecureStorage"
private let kErrorDomain = "com.babycryanalyzer.securestorage"
private let kKeyRotationInterval: TimeInterval = 2592000 // 30 days

// MARK: - SecureStorageError
@frozen private enum SecureStorageError: Int {
    case invalidInput = 1001
    case authenticationFailed = 1002
    case storageOperationFailed = 1003
    case encryptionFailed = 1004
    case biometricNotAvailable = 1005
    case keyRotationFailed = 1006
    
    var errorMessage: String {
        switch self {
        case .invalidInput: return "Invalid input parameters provided"
        case .authenticationFailed: return "Biometric authentication failed"
        case .storageOperationFailed: return "Storage operation failed"
        case .encryptionFailed: return "Encryption operation failed"
        case .biometricNotAvailable: return "Biometric authentication not available"
        case .keyRotationFailed: return "Key rotation operation failed"
        }
    }
}

// MARK: - SecureStorageModule
@objc(SecureStorageModule)
@objcMembers
final class SecureStorageModule: NSObject {
    
    // MARK: - Properties
    private let queue: DispatchQueue
    private let authContext: LAContext
    private var keyRotationTimer: Timer?
    
    // MARK: - Initialization
    override init() {
        self.queue = DispatchQueue(label: "com.babycryanalyzer.securestorage", qos: .userInitiated)
        self.authContext = LAContext()
        super.init()
        
        // Configure biometric authentication
        authContext.localizedCancelTitle = "Cancel Authentication"
        authContext.localizedFallbackTitle = "Use Passcode"
        
        // Set up key rotation timer
        scheduleKeyRotation()
        
        NSLog("[SECURITY_AUDIT] SecureStorageModule initialized")
    }
    
    // MARK: - React Native Requirements
    static func moduleName() -> String! {
        return kModuleName
    }
    
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    // MARK: - Public Interface
    
    @objc(setItem:value:requiresBiometric:resolver:rejecter:)
    func setItem(
        _ key: String,
        value: String,
        requiresBiometric: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard !key.isEmpty, !value.isEmpty else {
            rejectWithError(.invalidInput, reject)
            return
        }
        
        queue.async { [weak self] in
            guard let self = self else { return }
            
            // Handle biometric authentication if required
            if requiresBiometric {
                guard self.authContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
                    self.rejectWithError(.biometricNotAvailable, reject)
                    return
                }
                
                self.authContext.evaluatePolicy(
                    .deviceOwnerAuthenticationWithBiometrics,
                    localizedReason: "Authentication required to save secure data"
                ) { success, error in
                    if !success {
                        self.rejectWithError(.authenticationFailed, reject)
                        return
                    }
                    self.performSetItem(key: key, value: value, resolve: resolve, reject: reject)
                }
            } else {
                self.performSetItem(key: key, value: value, resolve: resolve, reject: reject)
            }
        }
    }
    
    @objc(getItem:requiresBiometric:resolver:rejecter:)
    func getItem(
        _ key: String,
        requiresBiometric: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard !key.isEmpty else {
            rejectWithError(.invalidInput, reject)
            return
        }
        
        queue.async { [weak self] in
            guard let self = self else { return }
            
            if requiresBiometric {
                guard self.authContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
                    self.rejectWithError(.biometricNotAvailable, reject)
                    return
                }
                
                self.authContext.evaluatePolicy(
                    .deviceOwnerAuthenticationWithBiometrics,
                    localizedReason: "Authentication required to access secure data"
                ) { success, error in
                    if !success {
                        self.rejectWithError(.authenticationFailed, reject)
                        return
                    }
                    self.performGetItem(key: key, resolve: resolve, reject: reject)
                }
            } else {
                self.performGetItem(key: key, resolve: resolve, reject: reject)
            }
        }
    }
    
    @objc(removeItem:resolver:rejecter:)
    func removeItem(
        _ key: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard !key.isEmpty else {
            rejectWithError(.invalidInput, reject)
            return
        }
        
        queue.async {
            let result = KeychainManager.standard.deleteItem(forKey: key)
            switch result {
            case .success:
                NSLog("[SECURITY_AUDIT] Successfully removed item for key: \(key)")
                resolve(true)
            case .failure:
                self.rejectWithError(.storageOperationFailed, reject)
            }
        }
    }
    
    @objc(clear:rejecter:)
    func clear(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        queue.async {
            let result = KeychainManager.standard.clearAll()
            switch result {
            case .success:
                NSLog("[SECURITY_AUDIT] Successfully cleared all items")
                resolve(true)
            case .failure:
                self.rejectWithError(.storageOperationFailed, reject)
            }
        }
    }
    
    // MARK: - Private Helpers
    
    private func performSetItem(
        key: String,
        value: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let data = value.data(using: .utf8) else {
            rejectWithError(.invalidInput, reject)
            return
        }
        
        // Encrypt data before storage
        let encryptionResult = SecurityUtils.encryptSensitiveData(
            data: data,
            key: KeychainManager.standard.currentKey,
            purpose: "SecureStorage"
        )
        
        switch encryptionResult {
        case .success(let encryptedData):
            let saveResult = KeychainManager.standard.saveItem(encryptedData, forKey: key)
            switch saveResult {
            case .success:
                NSLog("[SECURITY_AUDIT] Successfully saved encrypted item for key: \(key)")
                resolve(true)
            case .failure:
                rejectWithError(.storageOperationFailed, reject)
            }
        case .failure:
            rejectWithError(.encryptionFailed, reject)
        }
    }
    
    private func performGetItem(
        key: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let result = KeychainManager.standard.loadItem(forKey: key)
        switch result {
        case .success(let encryptedData):
            guard let data = encryptedData else {
                resolve(nil)
                return
            }
            
            let decryptionResult = SecurityUtils.decryptSensitiveData(
                encryptedData: data,
                key: KeychainManager.standard.currentKey,
                purpose: "SecureStorage"
            )
            
            switch decryptionResult {
            case .success(let decryptedData):
                guard let value = String(data: decryptedData, encoding: .utf8) else {
                    rejectWithError(.encryptionFailed, reject)
                    return
                }
                NSLog("[SECURITY_AUDIT] Successfully retrieved item for key: \(key)")
                resolve(value)
            case .failure:
                rejectWithError(.encryptionFailed, reject)
            }
        case .failure:
            rejectWithError(.storageOperationFailed, reject)
        }
    }
    
    private func rejectWithError(_ error: SecureStorageError, _ reject: RCTPromiseRejectBlock) {
        NSLog("[SECURITY_ERROR] \(error.errorMessage)")
        reject(
            String(error.rawValue),
            error.errorMessage,
            NSError(domain: kErrorDomain, code: error.rawValue, userInfo: nil)
        )
    }
    
    private func scheduleKeyRotation() {
        keyRotationTimer?.invalidate()
        keyRotationTimer = Timer.scheduledTimer(
            withTimeInterval: kKeyRotationInterval,
            repeats: true
        ) { [weak self] _ in
            self?.rotateEncryptionKey()
        }
    }
    
    private func rotateEncryptionKey() {
        queue.async {
            let result = KeychainManager.standard.rotateEncryptionKey()
            if case .failure = result {
                NSLog("[SECURITY_ERROR] Failed to rotate encryption key")
            }
        }
    }
    
    deinit {
        keyRotationTimer?.invalidate()
        NSLog("[SECURITY_AUDIT] SecureStorageModule deinitialized")
    }
}