package com.babycryanalyzer.storage

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList
import java.util.Collections

/**
 * React Native package implementation for SecureStorageModule that provides
 * AES-256 encrypted data persistence functionality.
 *
 * This package registers the SecureStorageModule which implements:
 * - AES-256-GCM encryption for data at rest
 * - Secure key management via Android Keystore
 * - Data integrity verification
 * - Automatic key rotation
 * - Storage size monitoring
 */
class SecureStoragePackage : ReactPackage {

    /**
     * Creates and returns a list containing the SecureStorageModule instance.
     * Implements thread-safe initialization and proper error handling.
     *
     * @param reactContext The React Native application context
     * @return List containing the initialized SecureStorageModule
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): 
        List<NativeModule> {
        return try {
            // Initialize with proper capacity for single module
            val modules = ArrayList<NativeModule>(1)
            
            // Create module instance with null safety check
            reactContext.let { context ->
                modules.add(SecureStorageModule(context))
            }
            
            // Return immutable list for thread safety
            Collections.unmodifiableList(modules)
        } catch (e: Exception) {
            // Return empty list if initialization fails
            Collections.emptyList()
        }
    }

    /**
     * Returns an empty list as this package doesn't provide any UI components.
     * Implemented for ReactPackage interface compliance.
     *
     * @param reactContext The React Native application context
     * @return Empty immutable list of ViewManager
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): 
        List<ViewManager<*, *>> {
        // Return empty immutable list since no view managers are needed
        return Collections.emptyList()
    }
}