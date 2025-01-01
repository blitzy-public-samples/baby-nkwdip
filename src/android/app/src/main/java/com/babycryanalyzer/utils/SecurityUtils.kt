package com.babycryanalyzer.utils

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import androidx.annotation.WorkerThread
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Utility class providing cryptographic operations with enhanced security features.
 * Implements AES-256-GCM encryption with authenticated encryption, secure key management,
 * and SHA-256 hashing functionality.
 */
class SecurityUtils private constructor() {
    init {
        throw IllegalStateException("Utility class - do not instantiate")
    }

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val ENCRYPTION_ALGORITHM = "AES/GCM/NoPadding"
        private const val KEY_ALIAS = "BABY_CRY_ANALYZER_KEY"
        private const val IV_LENGTH = 12
        private const val AUTH_TAG_LENGTH = 16
        private const val KEY_SIZE = 256
        private const val KEY_VALIDITY_YEARS = 1

        /**
         * Encrypts data using AES-256-GCM with authenticated encryption.
         * @param data ByteArray of data to encrypt
         * @return Triple of encrypted data, IV, and authentication tag
         * @throws SecurityException if encryption fails
         */
        @WorkerThread
        @Throws(SecurityException::class)
        fun encryptData(data: ByteArray): Triple<ByteArray, ByteArray, ByteArray> {
            try {
                require(data.isNotEmpty()) { "Input data cannot be empty" }

                // Get or create secret key
                val secretKey = getOrCreateSecretKey()

                // Generate random IV
                val iv = ByteArray(IV_LENGTH).apply {
                    SecureRandom().nextBytes(this)
                }

                // Initialize cipher for encryption
                val cipher = Cipher.getInstance(ENCRYPTION_ALGORITHM).apply {
                    init(Cipher.ENCRYPT_MODE, secretKey, GCMParameterSpec(AUTH_TAG_LENGTH * 8, iv))
                }

                // Perform encryption
                val encryptedData = cipher.doFinal(data)

                // Extract authentication tag (last AUTH_TAG_LENGTH bytes)
                val authTag = encryptedData.takeLast(AUTH_TAG_LENGTH).toByteArray()
                val actualEncryptedData = encryptedData.dropLast(AUTH_TAG_LENGTH).toByteArray()

                return Triple(actualEncryptedData, iv, authTag)
            } catch (e: Exception) {
                throw SecurityException("Encryption failed: ${e.message}", e)
            }
        }

        /**
         * Decrypts AES-256-GCM encrypted data with authentication verification.
         * @param encryptedData ByteArray of encrypted data
         * @param iv ByteArray of initialization vector
         * @param authTag ByteArray of authentication tag
         * @return ByteArray of decrypted data
         * @throws SecurityException if decryption fails
         */
        @WorkerThread
        @Throws(SecurityException::class)
        fun decryptData(encryptedData: ByteArray, iv: ByteArray, authTag: ByteArray): ByteArray {
            try {
                require(encryptedData.isNotEmpty()) { "Encrypted data cannot be empty" }
                require(iv.size == IV_LENGTH) { "Invalid IV length" }
                require(authTag.size == AUTH_TAG_LENGTH) { "Invalid authentication tag length" }

                // Get secret key
                val secretKey = getOrCreateSecretKey()

                // Initialize cipher for decryption
                val cipher = Cipher.getInstance(ENCRYPTION_ALGORITHM).apply {
                    init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(AUTH_TAG_LENGTH * 8, iv))
                }

                // Combine encrypted data with auth tag for authenticated decryption
                val combinedData = encryptedData + authTag

                // Perform decryption with authentication
                return cipher.doFinal(combinedData)
            } catch (e: Exception) {
                throw SecurityException("Decryption failed: ${e.message}", e)
            }
        }

        /**
         * Creates SHA-256 hash of input string with salt.
         * @param input String to hash
         * @param salt ByteArray of salt
         * @return Base64 encoded salted hash
         */
        fun hashString(input: String, salt: ByteArray): String {
            try {
                require(input.isNotEmpty()) { "Input string cannot be empty" }
                require(salt.isNotEmpty()) { "Salt cannot be empty" }

                // Combine input with salt
                val saltedInput = input.toByteArray() + salt

                // Create hash
                val messageDigest = MessageDigest.getInstance("SHA-256")
                val hash = messageDigest.digest(saltedInput)

                // Encode to Base64
                return Base64.encodeToString(hash, Base64.NO_WRAP)
            } catch (e: Exception) {
                throw SecurityException("Hashing failed: ${e.message}", e)
            }
        }

        /**
         * Retrieves or generates AES-256 key in Android Keystore with enhanced security parameters.
         * @return SecretKey for encryption/decryption
         * @throws SecurityException if key operations fail
         */
        @Throws(SecurityException::class)
        private fun getOrCreateSecretKey(): SecretKey {
            try {
                // Initialize KeyStore
                val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
                    load(null)
                }

                // Check if key exists and is valid
                keyStore.getKey(KEY_ALIAS, null)?.let { existingKey ->
                    return existingKey as SecretKey
                }

                // Generate new key if not exists
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    KEYSTORE_PROVIDER
                )

                // Set key validity period
                val calendar = Calendar.getInstance()
                val endDate = calendar.apply {
                    add(Calendar.YEAR, KEY_VALIDITY_YEARS)
                }.time

                // Configure key parameters
                val keyGenParameterSpec = KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                ).apply {
                    setKeySize(KEY_SIZE)
                    setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    setRandomizedEncryptionRequired(true)
                    setUserAuthenticationRequired(false)
                    setKeyValidityEnd(endDate)
                }.build()

                // Generate and return new key
                return keyGenerator.apply {
                    init(keyGenParameterSpec)
                }.generateKey()
            } catch (e: Exception) {
                throw SecurityException("Key operation failed: ${e.message}", e)
            }
        }
    }
}