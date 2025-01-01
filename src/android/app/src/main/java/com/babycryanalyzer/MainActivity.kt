package com.babycryanalyzer

import android.os.Bundle
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.babycryanalyzer.utils.PermissionUtils
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * Main activity for the Baby Cry Analyzer application.
 * Handles lifecycle management, permissions, and React Native initialization
 * with enhanced security features and proper state management.
 *
 * @version 1.0.0
 */
@AndroidEntryPoint
class MainActivity : ReactActivity() {
    companion object {
        private const val TAG = "MainActivity"
        private const val PERMISSIONS_REQUEST_CODE = 100
    }

    private var isInitialized = false
    private lateinit var activityDelegate: ReactActivityDelegate

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    override fun getMainComponentName(): String {
        Log.d(TAG, "Getting main component name")
        return "BabyCryAnalyzer"
    }

    /**
     * Enhanced onCreate lifecycle method with proper initialization
     * and permission handling.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(savedInstanceState)
            Log.d(TAG, "onCreate started")

            // Request necessary permissions
            if (!checkAndRequestPermissions()) {
                Log.w(TAG, "Required permissions not granted")
                return
            }

            // Initialize activity delegate
            activityDelegate = createReactActivityDelegate()

            // Configure security settings
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
            }

            isInitialized = true
            Log.d(TAG, "onCreate completed successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error during activity creation", e)
            finish()
        }
    }

    /**
     * Creates and configures the React Activity Delegate with enhanced
     * error handling and security features.
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return try {
            Log.d(TAG, "Creating ReactActivityDelegate")
            DefaultReactActivityDelegate(
                this,
                mainComponentName,
                // Enable Fabric for improved performance
                true
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error creating ReactActivityDelegate", e)
            throw RuntimeException("Failed to create ReactActivityDelegate", e)
        }
    }

    /**
     * Handles permission results with proper error handling and logging.
     */
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        when (requestCode) {
            PERMISSIONS_REQUEST_CODE -> {
                val allPermissionsGranted = grantResults.all { 
                    it == PackageManager.PERMISSION_GRANTED 
                }
                
                if (allPermissionsGranted) {
                    Log.d(TAG, "All required permissions granted")
                    recreate()
                } else {
                    Log.w(TAG, "Some permissions were denied")
                    // Show explanation dialog or handle denied permissions
                    handleDeniedPermissions(permissions, grantResults)
                }
            }
        }
    }

    /**
     * Enhanced onDestroy lifecycle method with proper cleanup.
     */
    override fun onDestroy() {
        try {
            if (isInitialized) {
                // Perform cleanup
                activityDelegate.onHostDestroy()
                isInitialized = false
            }
            Log.d(TAG, "Activity destroyed successfully")
            super.onDestroy()
        } catch (e: Exception) {
            Log.e(TAG, "Error during activity destruction", e)
        }
    }

    /**
     * Checks and requests required permissions with enhanced error handling.
     */
    private fun checkAndRequestPermissions(): Boolean {
        try {
            val requiredPermissions = mutableListOf(
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE
            )

            // Add notification permission for Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requiredPermissions.add(android.Manifest.permission.POST_NOTIFICATIONS)
            }

            val permissionsToRequest = requiredPermissions.filter {
                ActivityCompat.checkSelfPermission(this, it) != 
                    PackageManager.PERMISSION_GRANTED
            }

            return if (permissionsToRequest.isNotEmpty()) {
                Log.d(TAG, "Requesting permissions: ${permissionsToRequest.joinToString()}")
                ActivityCompat.requestPermissions(
                    this,
                    permissionsToRequest.toTypedArray(),
                    PERMISSIONS_REQUEST_CODE
                )
                false
            } else {
                Log.d(TAG, "All required permissions already granted")
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking permissions", e)
            return false
        }
    }

    /**
     * Handles denied permissions with user feedback.
     */
    private fun handleDeniedPermissions(permissions: Array<String>, grantResults: IntArray) {
        permissions.forEachIndexed { index, permission ->
            if (grantResults[index] == PackageManager.PERMISSION_DENIED) {
                if (ActivityCompat.shouldShowRequestPermissionRationale(this, permission)) {
                    // Show explanation dialog
                    Log.d(TAG, "Should show rationale for permission: $permission")
                } else {
                    // Permission permanently denied, guide user to settings
                    Log.w(TAG, "Permission permanently denied: $permission")
                }
            }
        }
    }

    /**
     * Handles new intents with proper validation.
     */
    override fun onNewIntent(intent: Intent?) {
        try {
            super.onNewIntent(intent)
            if (isInitialized && intent != null) {
                activityDelegate.onNewIntent(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling new intent", e)
        }
    }
}