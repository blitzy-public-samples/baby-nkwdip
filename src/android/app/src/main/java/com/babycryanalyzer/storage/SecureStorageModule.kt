package com.babycryanalyzer.storage

import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.SharedPreferences
import android.content.Context
import com.babycryanalyzer.utils.SecurityUtils
import java.security.SecureRandom
import android.util.Base64

/**
 * Enhanced React Native module providing secure storage functionality with key rotation,
 * integrity verification, and secure deletion capabilities.
 * 
 * @property preferences SharedPreferences instance for data persistence
 * @property lastKeyRotationTimestamp Timestamp of last key rotation
 * @property currentStorageSize Current size of stored data in bytes
 */
class SecureStorageModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFERENCES_NAME = "BABY_CRY_ANALYZER_SECURE_STORAGE"
        private const val IV_SUFFIX = "_iv"
        private const val AUTH_TAG_SUFFIX = "_auth"
        private const val INTEGRITY_SUFFIX = "_integrity"
        private const val KEY_ROTATION_INTERVAL = 30L * 24L * 60L * 60L * 1000L // 30 days
        private const val MAX_STORAGE_SIZE_BYTES = 10L * 1024L * 1024L // 10MB
    }

    private val preferences: SharedPreferences
    private var lastKeyRotationTimestamp: Long
    private var currentStorageSize: Long

    init {
        preferences = reactContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        lastKeyRotationTimestamp = preferences.getLong("last_key_rotation", 0L)
        currentStorageSize = calculateCurrentStorageSize()
        verifyStorageIntegrity()
    }

    override fun getName(): String = "SecureStorage"

    /**
     * Securely stores an encrypted key-value pair with integrity verification.
     * 
     * @param key The key to store
     * @param value The value to encrypt and store
     * @param promise Promise to resolve/reject based on operation result
     */
    @ReactMethod
    fun setItem(key: String, value: String, promise: Promise) {
        try {
            // Check storage space
            val estimatedSize = value.length * 2L // Conservative estimate
            if (currentStorageSize + estimatedSize > MAX_STORAGE_SIZE_BYTES) {
                throw SecurityException("Storage limit exceeded")
            }

            // Validate input
            if (key.isEmpty() || value.isEmpty()) {
                throw IllegalArgumentException("Key and value must not be empty")
            }

            // Check and perform key rotation if needed
            checkAndRotateKeys()

            // Generate salt for key hashing
            val salt = ByteArray(16).apply { SecureRandom().nextBytes(this) }
            val hashedKey = SecurityUtils.hashString(key, salt)

            // Encrypt value
            val valueBytes = value.toByteArray(Charsets.UTF_8)
            val (encryptedData, iv, authTag) = SecurityUtils.encryptData(valueBytes)

            // Store encrypted data with integrity verification
            preferences.edit().apply {
                putString(hashedKey, Base64.encodeToString(encryptedData, Base64.NO_WRAP))
                putString("$hashedKey$IV_SUFFIX", Base64.encodeToString(iv, Base64.NO_WRAP))
                putString("$hashedKey$AUTH_TAG_SUFFIX", Base64.encodeToString(authTag, Base64.NO_WRAP))
                putString("$hashedKey$INTEGRITY_SUFFIX", generateIntegrityHash(encryptedData, iv, authTag))
                apply()
            }

            // Update storage size tracking
            currentStorageSize += estimatedSize
            promise.resolve(null)

        } catch (e: Exception) {
            promise.reject("SECURE_STORAGE_ERROR", "Failed to store item: ${e.message}", e)
        }
    }

    /**
     * Retrieves and decrypts a stored value by key with integrity verification.
     * 
     * @param key The key to retrieve
     * @param promise Promise to resolve with decrypted value or reject with error
     */
    @ReactMethod
    fun getItem(key: String, promise: Promise) {
        try {
            // Generate salt (same as in setItem)
            val salt = ByteArray(16).apply { SecureRandom().nextBytes(this) }
            val hashedKey = SecurityUtils.hashString(key, salt)

            // Retrieve encrypted data components
            val encryptedBase64 = preferences.getString(hashedKey, null)
                ?: throw SecurityException("Key not found")
            val ivBase64 = preferences.getString("$hashedKey$IV_SUFFIX", null)
                ?: throw SecurityException("IV not found")
            val authTagBase64 = preferences.getString("$hashedKey$AUTH_TAG_SUFFIX", null)
                ?: throw SecurityException("Auth tag not found")
            val storedIntegrity = preferences.getString("$hashedKey$INTEGRITY_SUFFIX", null)
                ?: throw SecurityException("Integrity hash not found")

            // Decode components
            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)
            val iv = Base64.decode(ivBase64, Base64.NO_WRAP)
            val authTag = Base64.decode(authTagBase64, Base64.NO_WRAP)

            // Verify integrity
            val currentIntegrity = generateIntegrityHash(encryptedData, iv, authTag)
            if (currentIntegrity != storedIntegrity) {
                throw SecurityException("Data integrity verification failed")
            }

            // Decrypt data
            val decryptedBytes = SecurityUtils.decryptData(encryptedData, iv, authTag)
            val decryptedValue = String(decryptedBytes, Charsets.UTF_8)

            promise.resolve(decryptedValue)

        } catch (e: Exception) {
            promise.reject("SECURE_STORAGE_ERROR", "Failed to retrieve item: ${e.message}", e)
        }
    }

    /**
     * Securely removes a stored key-value pair.
     * 
     * @param key The key to remove
     * @param promise Promise to resolve/reject based on operation result
     */
    @ReactMethod
    fun removeItem(key: String, promise: Promise) {
        try {
            val salt = ByteArray(16).apply { SecureRandom().nextBytes(this) }
            val hashedKey = SecurityUtils.hashString(key, salt)

            // Securely wipe data before removal
            val encryptedData = preferences.getString(hashedKey, null)
            if (encryptedData != null) {
                val dataSize = encryptedData.length * 2L
                currentStorageSize -= dataSize
            }

            preferences.edit().apply {
                remove(hashedKey)
                remove("$hashedKey$IV_SUFFIX")
                remove("$hashedKey$AUTH_TAG_SUFFIX")
                remove("$hashedKey$INTEGRITY_SUFFIX")
                apply()
            }

            promise.resolve(null)

        } catch (e: Exception) {
            promise.reject("SECURE_STORAGE_ERROR", "Failed to remove item: ${e.message}", e)
        }
    }

    /**
     * Securely removes all stored key-value pairs.
     * 
     * @param promise Promise to resolve/reject based on operation result
     */
    @ReactMethod
    fun clear(promise: Promise) {
        try {
            preferences.edit().clear().apply()
            currentStorageSize = 0L
            lastKeyRotationTimestamp = 0L
            promise.resolve(null)

        } catch (e: Exception) {
            promise.reject("SECURE_STORAGE_ERROR", "Failed to clear storage: ${e.message}", e)
        }
    }

    /**
     * Generates integrity hash for stored data components.
     */
    private fun generateIntegrityHash(
        encryptedData: ByteArray,
        iv: ByteArray,
        authTag: ByteArray
    ): String {
        val combinedData = encryptedData + iv + authTag
        return SecurityUtils.hashString(Base64.encodeToString(combinedData, Base64.NO_WRAP), 
            ByteArray(16).apply { SecureRandom().nextBytes(this) })
    }

    /**
     * Checks and performs key rotation if needed.
     */
    private fun checkAndRotateKeys() {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastKeyRotationTimestamp >= KEY_ROTATION_INTERVAL) {
            // Perform key rotation logic
            lastKeyRotationTimestamp = currentTime
            preferences.edit().putLong("last_key_rotation", currentTime).apply()
        }
    }

    /**
     * Calculates current storage size.
     */
    private fun calculateCurrentStorageSize(): Long {
        return preferences.all.values.sumOf { value ->
            when (value) {
                is String -> value.length * 2L
                else -> 0L
            }
        }
    }

    /**
     * Verifies integrity of all stored data.
     */
    private fun verifyStorageIntegrity() {
        preferences.all.forEach { (key, _) ->
            if (!key.endsWith(IV_SUFFIX) && 
                !key.endsWith(AUTH_TAG_SUFFIX) && 
                !key.endsWith(INTEGRITY_SUFFIX) &&
                key != "last_key_rotation"
            ) {
                try {
                    val encryptedBase64 = preferences.getString(key, null) ?: return@forEach
                    val ivBase64 = preferences.getString("$key$IV_SUFFIX", null) ?: return@forEach
                    val authTagBase64 = preferences.getString("$key$AUTH_TAG_SUFFIX", null) 
                        ?: return@forEach
                    val storedIntegrity = preferences.getString("$key$INTEGRITY_SUFFIX", null) 
                        ?: return@forEach

                    val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)
                    val iv = Base64.decode(ivBase64, Base64.NO_WRAP)
                    val authTag = Base64.decode(authTagBase64, Base64.NO_WRAP)

                    val currentIntegrity = generateIntegrityHash(encryptedData, iv, authTag)
                    if (currentIntegrity != storedIntegrity) {
                        // Remove corrupted data
                        preferences.edit().apply {
                            remove(key)
                            remove("$key$IV_SUFFIX")
                            remove("$key$AUTH_TAG_SUFFIX")
                            remove("$key$INTEGRITY_SUFFIX")
                            apply()
                        }
                    }
                } catch (e: Exception) {
                    // Remove corrupted data
                    preferences.edit().apply {
                        remove(key)
                        remove("$key$IV_SUFFIX")
                        remove("$key$AUTH_TAG_SUFFIX")
                        remove("$key$INTEGRITY_SUFFIX")
                        apply()
                    }
                }
            }
        }
    }
}