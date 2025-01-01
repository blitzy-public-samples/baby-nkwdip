package com.babycryanalyzer.background

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package implementation that registers the BackgroundTaskModule
 * with enhanced error handling, performance optimization, and lifecycle management.
 *
 * @version 1.0.0
 */
class BackgroundTaskPackage : ReactPackage {
    companion object {
        private const val TAG = "BackgroundTaskPackage"
    }

    // Cache module instance for reuse
    private var moduleInstance: BackgroundTaskModule? = null

    /**
     * Creates and returns a list of native modules with enhanced error handling and caching.
     * Implements module instance caching for improved performance and resource management.
     *
     * @param reactContext React Native application context
     * @return List containing the BackgroundTaskModule instance
     * @throws IllegalStateException if module creation fails
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        try {
            Log.d(TAG, "Creating native modules")

            // Validate context
            requireNotNull(reactContext) { "ReactApplicationContext cannot be null" }

            val modules = ArrayList<NativeModule>()

            // Reuse cached module instance if available
            if (moduleInstance == null) {
                Log.d(TAG, "Creating new BackgroundTaskModule instance")
                moduleInstance = BackgroundTaskModule(reactContext, reactContext.applicationContext)
            } else {
                Log.d(TAG, "Reusing existing BackgroundTaskModule instance")
            }

            modules.add(moduleInstance!!)
            Log.d(TAG, "Successfully created native modules")

            return modules
        } catch (e: Exception) {
            Log.e(TAG, "Error creating native modules", e)
            throw IllegalStateException("Failed to create native modules: ${e.message}", e)
        }
    }

    /**
     * Creates and returns an empty list of view managers as this package
     * does not provide any custom views.
     *
     * @param reactContext React Native application context
     * @return Empty list as no view managers are needed
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        Log.d(TAG, "Creating view managers (empty list)")
        return emptyList()
    }

    /**
     * Performs cleanup of module resources to prevent memory leaks.
     * Should be called when the package is no longer needed.
     */
    fun cleanup() {
        Log.d(TAG, "Cleaning up BackgroundTaskPackage resources")
        moduleInstance = null
        Log.d(TAG, "Cleanup completed")
    }
}