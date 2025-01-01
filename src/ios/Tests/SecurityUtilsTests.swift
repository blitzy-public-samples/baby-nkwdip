import XCTest
import Foundation
@testable import BabyCryAnalyzer

final class SecurityUtilsTests: XCTestCase {
    
    // MARK: - Properties
    private var testData: Data!
    private var testKey: Data!
    private var sensitiveData: Data!
    private var testAuditLog: String!
    
    // MARK: - Setup
    override func setUp() {
        super.setUp()
        
        // Initialize test data
        testData = "Test sensitive information".data(using: .utf8)!
        sensitiveData = """
        {
            "name": "John Doe",
            "dob": "2023-01-01",
            "medicalId": "12345"
        }
        """.data(using: .utf8)!
        testAuditLog = ""
    }
    
    override func tearDown() {
        // Securely clear sensitive test data
        testData = nil
        testKey = nil
        sensitiveData = nil
        testAuditLog = nil
        super.tearDown()
    }
    
    // MARK: - Key Generation Tests
    
    func testGenerateEncryptionKey() throws {
        // Test key generation with valid purpose
        let keyResult = SecurityUtils.generateEncryptionKey(purpose: "TestEncryption")
        
        switch keyResult {
        case .success(let key):
            XCTAssertEqual(key.count, 256 / 8, "Generated key should be 256 bits")
            XCTAssertFalse(key.isEmpty, "Generated key should not be empty")
            
            // Test key uniqueness
            let secondKeyResult = SecurityUtils.generateEncryptionKey(purpose: "TestEncryption")
            if case .success(let secondKey) = secondKeyResult {
                XCTAssertNotEqual(key, secondKey, "Generated keys should be unique")
            }
            
        case .failure(let error):
            XCTFail("Key generation failed with error: \(error.errorDescription)")
        }
        
        // Test key generation with invalid purpose
        let invalidResult = SecurityUtils.generateEncryptionKey(purpose: "")
        if case .failure(let error) = invalidResult {
            XCTAssertEqual(error.errorCode, "SEC_001", "Should fail with invalid input error")
        } else {
            XCTFail("Should fail with empty purpose")
        }
    }
    
    // MARK: - Encryption/Decryption Tests
    
    func testEncryptDecryptDataCompliance() throws {
        // Generate test key
        guard case .success(let key) = SecurityUtils.generateEncryptionKey(purpose: "TestEncryption") else {
            XCTFail("Failed to generate test key")
            return
        }
        
        // Test encryption
        let encryptResult = SecurityUtils.encryptSensitiveData(
            data: sensitiveData,
            key: key,
            purpose: "PIIEncryption"
        )
        
        switch encryptResult {
        case .success(let encryptedData):
            XCTAssertNotEqual(encryptedData, sensitiveData, "Encrypted data should differ from original")
            
            // Test decryption
            let decryptResult = SecurityUtils.decryptSensitiveData(
                encryptedData: encryptedData,
                key: key,
                purpose: "PIIDecryption"
            )
            
            switch decryptResult {
            case .success(let decryptedData):
                XCTAssertEqual(decryptedData, sensitiveData, "Decrypted data should match original")
                
            case .failure(let error):
                XCTFail("Decryption failed with error: \(error.errorDescription)")
            }
            
        case .failure(let error):
            XCTFail("Encryption failed with error: \(error.errorDescription)")
        }
        
        // Test invalid key handling
        let invalidKey = Data(count: 16) // Wrong key size
        let invalidResult = SecurityUtils.encryptSensitiveData(
            data: sensitiveData,
            key: invalidKey,
            purpose: "InvalidTest"
        )
        
        if case .failure(let error) = invalidResult {
            XCTAssertEqual(error.errorCode, "SEC_003", "Should fail with encryption error")
        } else {
            XCTFail("Should fail with invalid key")
        }
    }
    
    // MARK: - Key Rotation Tests
    
    func testKeyRotationAndExpiration() throws {
        // Generate initial key
        guard case .success(let initialKey) = SecurityUtils.generateEncryptionKey(
            purpose: "RotationTest",
            expirationDate: Date(timeIntervalSinceNow: 1)
        ) else {
            XCTFail("Failed to generate initial key")
            return
        }
        
        // Encrypt test data with initial key
        guard case .success(let encryptedData) = SecurityUtils.encryptSensitiveData(
            data: testData,
            key: initialKey,
            purpose: "RotationTest"
        ) else {
            XCTFail("Failed to encrypt test data")
            return
        }
        
        // Perform key rotation
        let rotationResult = SecurityUtils.rotateEncryptionKey(
            oldKey: initialKey,
            purpose: "RotationTest"
        )
        
        switch rotationResult {
        case .success(let newKey):
            XCTAssertNotEqual(newKey, initialKey, "Rotated key should differ from initial key")
            
            // Verify data can be decrypted with new key after re-encryption
            guard case .success(let reencryptedData) = SecurityUtils.encryptSensitiveData(
                data: testData,
                key: newKey,
                purpose: "RotationTest"
            ) else {
                XCTFail("Failed to re-encrypt with new key")
                return
            }
            
            guard case .success(let decryptedData) = SecurityUtils.decryptSensitiveData(
                encryptedData: reencryptedData,
                key: newKey,
                purpose: "RotationTest"
            ) else {
                XCTFail("Failed to decrypt with new key")
                return
            }
            
            XCTAssertEqual(decryptedData, testData, "Data should remain intact after key rotation")
            
        case .failure(let error):
            XCTFail("Key rotation failed with error: \(error.errorDescription)")
        }
    }
    
    // MARK: - Concurrent Operation Tests
    
    func testConcurrentOperations() throws {
        let operationQueue = OperationQueue()
        let expectation = XCTestExpectation(description: "Concurrent security operations")
        let operationCount = 100
        
        guard case .success(let key) = SecurityUtils.generateEncryptionKey(purpose: "ConcurrentTest") else {
            XCTFail("Failed to generate test key")
            return
        }
        
        var results: [Bool] = Array(repeating: false, count: operationCount)
        let lock = NSLock()
        
        for i in 0..<operationCount {
            operationQueue.addOperation {
                // Perform concurrent encryption/decryption
                guard case .success(let encrypted) = SecurityUtils.encryptSensitiveData(
                    data: self.testData,
                    key: key,
                    purpose: "ConcurrentTest"
                ) else {
                    return
                }
                
                guard case .success(let decrypted) = SecurityUtils.decryptSensitiveData(
                    encryptedData: encrypted,
                    key: key,
                    purpose: "ConcurrentTest"
                ) else {
                    return
                }
                
                lock.lock()
                results[i] = decrypted == self.testData
                lock.unlock()
                
                if i == operationCount - 1 {
                    expectation.fulfill()
                }
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
        
        // Verify all operations completed successfully
        XCTAssertTrue(results.allSatisfy { $0 }, "All concurrent operations should succeed")
    }
}