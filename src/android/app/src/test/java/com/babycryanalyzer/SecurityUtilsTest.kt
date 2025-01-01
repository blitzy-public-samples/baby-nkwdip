package com.babycryanalyzer

import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.babycryanalyzer.utils.SecurityUtils
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.security.SecureRandom
import javax.crypto.AEADBadTagException

/**
 * Comprehensive test suite for SecurityUtils cryptographic operations.
 * Validates encryption, decryption, hashing, and security compliance.
 * Version: 1.0
 */
@RunWith(AndroidJUnit4::class)
class SecurityUtilsTest {

    private lateinit var testData: ByteArray
    private lateinit var testString: String
    private lateinit var testSalt: ByteArray
    private lateinit var largeTestData: ByteArray

    @Before
    fun setUp() {
        // Initialize test data with various sizes and patterns
        testData = "Test data for encryption".toByteArray()
        testString = "SensitiveTestData123!@#"
        testSalt = ByteArray(16).apply { SecureRandom().nextBytes(this) }
        largeTestData = ByteArray(1024 * 1024) { // 1MB test data
            (it % 256).toByte()
        }
    }

    @After
    fun tearDown() {
        // Clear sensitive test data
        testData.fill(0)
        testString = ""
        testSalt.fill(0)
        largeTestData.fill(0)
    }

    @Test
    fun testEncryptionDecryption() {
        // Test basic encryption/decryption flow
        val (encryptedData, iv, authTag) = SecurityUtils.encryptData(testData)

        assertNotNull("Encrypted data should not be null", encryptedData)
        assertEquals("IV length should be 12 bytes", 12, iv.size)
        assertEquals("Auth tag length should be 16 bytes", 16, authTag.size)

        // Test decryption
        val decryptedData = SecurityUtils.decryptData(encryptedData, iv, authTag)
        assertArrayEquals("Decrypted data should match original", testData, decryptedData)

        // Test with empty data
        assertThrows(IllegalArgumentException::class.java) {
            SecurityUtils.encryptData(ByteArray(0))
        }

        // Test with large data
        val (largeEncrypted, largeIv, largeAuthTag) = SecurityUtils.encryptData(largeTestData)
        val largeDecrypted = SecurityUtils.decryptData(largeEncrypted, largeIv, largeAuthTag)
        assertArrayEquals("Large data encryption/decryption should work", largeTestData, largeDecrypted)
    }

    @Test
    fun testAuthenticationTagVerification() {
        val (encryptedData, iv, authTag) = SecurityUtils.encryptData(testData)
        
        // Tamper with auth tag
        val tamperedTag = authTag.clone()
        tamperedTag[0] = (tamperedTag[0] + 1).toByte()

        // Verify that tampered auth tag fails decryption
        assertThrows(AEADBadTagException::class.java) {
            SecurityUtils.decryptData(encryptedData, iv, tamperedTag)
        }

        // Verify that tampered encrypted data fails authentication
        val tamperedData = encryptedData.clone()
        tamperedData[0] = (tamperedData[0] + 1).toByte()
        assertThrows(AEADBadTagException::class.java) {
            SecurityUtils.decryptData(tamperedData, iv, authTag)
        }
    }

    @Test
    fun testHashString() {
        // Test basic hashing
        val hash1 = SecurityUtils.hashString(testString, testSalt)
        val hash2 = SecurityUtils.hashString(testString, testSalt)
        
        assertNotNull("Hash should not be null", hash1)
        assertEquals("Hash should be deterministic", hash1, hash2)
        assertTrue("Hash should be Base64 encoded", isBase64(hash1))

        // Test with empty string
        assertThrows(IllegalArgumentException::class.java) {
            SecurityUtils.hashString("", testSalt)
        }

        // Test with empty salt
        assertThrows(IllegalArgumentException::class.java) {
            SecurityUtils.hashString(testString, ByteArray(0))
        }

        // Test hash uniqueness with different salts
        val differentSalt = ByteArray(16).apply { SecureRandom().nextBytes(this) }
        val hash3 = SecurityUtils.hashString(testString, differentSalt)
        assertNotEquals("Hashes with different salts should differ", hash1, hash3)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun testConcurrentAccess() = runTest {
        val iterations = 10
        val testDataList = List(iterations) { index ->
            "Test data $index".toByteArray()
        }

        // Perform concurrent encryption operations
        val encryptionResults = testDataList.map { data ->
            async {
                SecurityUtils.encryptData(data)
            }
        }.map { it.await() }

        // Verify all encryptions succeeded
        assertEquals("All encryption operations should complete", iterations, encryptionResults.size)

        // Perform concurrent decryption operations
        val decryptionResults = encryptionResults.map { (encrypted, iv, authTag) ->
            async {
                SecurityUtils.decryptData(encrypted, iv, authTag)
            }
        }.map { it.await() }

        // Verify all decryptions match original data
        testDataList.zip(decryptionResults).forEach { (original, decrypted) ->
            assertArrayEquals("Concurrent encryption/decryption should preserve data", 
                            original, decrypted)
        }
    }

    /**
     * Utility function to verify Base64 encoding
     */
    private fun isBase64(str: String): Boolean {
        return try {
            Base64.decode(str, Base64.NO_WRAP)
            true
        } catch (e: IllegalArgumentException) {
            false
        }
    }

    @Test
    fun testEdgeCases() {
        // Test with maximum allowed data size
        val maxData = ByteArray(Int.MAX_VALUE / 8) // Practical maximum size
        assertThrows(OutOfMemoryError::class.java) {
            SecurityUtils.encryptData(maxData)
        }

        // Test with special characters
        val specialChars = "!@#$%^&*()_+-=[]{}|;:'\",.<>?`~"
        val specialHash = SecurityUtils.hashString(specialChars, testSalt)
        assertNotNull("Hash should handle special characters", specialHash)

        // Test with Unicode characters
        val unicodeString = "Hello 世界 🌍"
        val unicodeHash = SecurityUtils.hashString(unicodeString, testSalt)
        assertNotNull("Hash should handle Unicode characters", unicodeHash)
    }
}