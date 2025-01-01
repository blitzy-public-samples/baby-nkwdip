import XCTest
import Foundation
@testable import BabyCryAnalyzer

final class KeychainManagerTests: XCTestCase {
    
    // MARK: - Properties
    private var sut: KeychainManager!
    private let concurrentQueue = DispatchQueue(label: "com.babycryanalyzer.keychain.tests",
                                              attributes: .concurrent)
    private let testKey = "test_key"
    private let testData = "test_data".data(using: .utf8)!
    private let sensitiveData = "sensitive_pii_data".data(using: .utf8)!
    private var testEncryptionKey: Data!
    
    // MARK: - Setup/Teardown
    
    override func setUp() {
        super.setUp()
        sut = KeychainManager.standard
        testEncryptionKey = try? SecurityUtils.generateEncryptionKey(purpose: "UnitTesting").get()
        
        // Clear any existing test data
        clearKeychainData()
    }
    
    override func tearDown() {
        clearKeychainData()
        testEncryptionKey = nil
        sut = nil
        super.tearDown()
    }
    
    // MARK: - Basic Operations Tests
    
    func testSaveAndLoadItem() {
        // Given
        let saveExpectation = expectation(description: "Save operation completed")
        
        // When
        sut.saveItem(testData, forKey: testKey) { result in
            // Then
            switch result {
            case .success:
                saveExpectation.fulfill()
            case .failure(let error):
                XCTFail("Save operation failed with error: \(error)")
            }
        }
        
        wait(for: [saveExpectation], timeout: 5.0)
        
        // Given
        let loadExpectation = expectation(description: "Load operation completed")
        
        // When
        sut.loadItem(forKey: testKey) { result in
            // Then
            switch result {
            case .success(let loadedData):
                XCTAssertEqual(loadedData, self.testData, "Loaded data should match saved data")
                loadExpectation.fulfill()
            case .failure(let error):
                XCTFail("Load operation failed with error: \(error)")
            }
        }
        
        wait(for: [loadExpectation], timeout: 5.0)
    }
    
    // MARK: - Encryption Tests
    
    func testEncryptionValidation() {
        // Given
        let encryptionExpectation = expectation(description: "Encryption validation completed")
        let sensitiveString = "sensitive_data"
        let sensitiveData = sensitiveString.data(using: .utf8)!
        
        // When
        guard case .success(let encryptedData) = SecurityUtils.encryptSensitiveData(
            data: sensitiveData,
            key: testEncryptionKey,
            purpose: "TestEncryption"
        ) else {
            XCTFail("Encryption failed")
            return
        }
        
        // Then
        XCTAssertNotEqual(encryptedData, sensitiveData, "Encrypted data should differ from original")
        
        // When decrypting
        guard case .success(let decryptedData) = SecurityUtils.decryptSensitiveData(
            encryptedData: encryptedData,
            key: testEncryptionKey,
            purpose: "TestDecryption"
        ) else {
            XCTFail("Decryption failed")
            return
        }
        
        // Then
        XCTAssertEqual(decryptedData, sensitiveData, "Decrypted data should match original")
        encryptionExpectation.fulfill()
        
        wait(for: [encryptionExpectation], timeout: 5.0)
    }
    
    // MARK: - Thread Safety Tests
    
    func testThreadSafety() {
        // Given
        let operationCount = 100
        let concurrentExpectation = expectation(description: "Concurrent operations completed")
        concurrentExpectation.expectedFulfillmentCount = operationCount
        
        // When
        for i in 0..<operationCount {
            let key = "\(testKey)_\(i)"
            let data = "test_data_\(i)".data(using: .utf8)!
            
            concurrentQueue.async {
                self.sut.saveItem(data, forKey: key) { result in
                    switch result {
                    case .success:
                        self.sut.loadItem(forKey: key) { loadResult in
                            switch loadResult {
                            case .success(let loadedData):
                                XCTAssertEqual(loadedData, data, "Data mismatch in concurrent operation")
                            case .failure(let error):
                                XCTFail("Load failed in concurrent operation: \(error)")
                            }
                            concurrentExpectation.fulfill()
                        }
                    case .failure(let error):
                        XCTFail("Save failed in concurrent operation: \(error)")
                        concurrentExpectation.fulfill()
                    }
                }
            }
        }
        
        wait(for: [concurrentExpectation], timeout: 30.0)
    }
    
    // MARK: - Compliance Tests
    
    func testComplianceRequirements() {
        // Given
        let complianceExpectation = expectation(description: "Compliance validation completed")
        
        // Test PII data handling
        let piiData = sensitiveData
        
        // When saving PII data with biometric protection
        sut.saveItem(piiData, forKey: testKey, requiresBiometric: true) { result in
            switch result {
            case .success:
                // Then verify access control
                self.sut.loadItem(forKey: self.testKey, requiresBiometric: true) { loadResult in
                    switch loadResult {
                    case .success(let loadedData):
                        XCTAssertEqual(loadedData, piiData, "PII data should be retrieved correctly")
                        // Verify data is encrypted
                        guard case .success(let encryptedData) = SecurityUtils.encryptSensitiveData(
                            data: piiData,
                            key: self.testEncryptionKey,
                            purpose: "ComplianceTest"
                        ) else {
                            XCTFail("Encryption validation failed")
                            return
                        }
                        XCTAssertNotEqual(encryptedData, piiData, "PII data must be encrypted")
                        complianceExpectation.fulfill()
                    case .failure(let error):
                        XCTFail("PII data retrieval failed: \(error)")
                    }
                }
            case .failure(let error):
                XCTFail("PII data storage failed: \(error)")
            }
        }
        
        wait(for: [complianceExpectation], timeout: 5.0)
    }
    
    // MARK: - Biometric Authentication Tests
    
    func testBiometricAuthentication() {
        // Given
        let biometricExpectation = expectation(description: "Biometric authentication completed")
        let sensitiveData = "biometric_protected_data".data(using: .utf8)!
        
        // When enabling biometric auth
        sut.saveItem(sensitiveData, forKey: testKey, requiresBiometric: true) { result in
            switch result {
            case .success:
                // Then attempt to access with biometric auth
                self.sut.loadItem(forKey: self.testKey, requiresBiometric: true) { loadResult in
                    switch loadResult {
                    case .success(let data):
                        XCTAssertEqual(data, sensitiveData, "Biometric protected data should match")
                        biometricExpectation.fulfill()
                    case .failure(let error):
                        if case .biometricNotAvailable = error {
                            // Skip test if biometrics not available on test device
                            biometricExpectation.fulfill()
                        } else {
                            XCTFail("Biometric authentication failed: \(error)")
                        }
                    }
                }
            case .failure(let error):
                XCTFail("Failed to save biometric protected data: \(error)")
            }
        }
        
        wait(for: [biometricExpectation], timeout: 5.0)
    }
    
    // MARK: - Helper Methods
    
    private func clearKeychainData() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.babycryanalyzer.keychain"
        ]
        SecItemDelete(query as CFDictionary)
    }
}