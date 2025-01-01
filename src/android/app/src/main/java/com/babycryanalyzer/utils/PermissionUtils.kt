package com.babycryanalyzer.utils

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Utility object for managing Android runtime permissions in the Baby Cry Analyzer app.
 * Handles permissions for audio recording, background services, and storage with enhanced security.
 * 
 * @since 1.0.0
 * @version 1.2.0
 */
object PermissionUtils {
    private const val TAG = "PermissionUtils"
    
    // Permission request codes
    const val PERMISSION_REQUEST_CODE_AUDIO = 1001
    const val PERMISSION_REQUEST_CODE_BACKGROUND = 1002
    const val PERMISSION_REQUEST_CODE_STORAGE = 1003
    
    // Timeout for permission requests (5 seconds)
    private const val PERMISSION_REQUEST_TIMEOUT = 5000L
    
    // Required permissions array
    private val REQUIRED_PERMISSIONS = arrayOf(
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.FOREGROUND_SERVICE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.POST_NOTIFICATIONS
    )

    /**
     * Checks if the app has all necessary audio recording permissions.
     * 
     * @param context Application context
     * @return Boolean indicating if audio permissions are granted
     */
    fun checkAudioPermissions(context: Context): Boolean {
        return try {
            val hasAudioPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

            // Additional storage permission check for older Android versions
            val hasStoragePermission = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ) == PackageManager.PERMISSION_GRANTED
            } else true

            Log.d(TAG, "Audio permissions check - Audio: $hasAudioPermission, Storage: $hasStoragePermission")
            hasAudioPermission && hasStoragePermission
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception checking audio permissions", e)
            false
        }
    }

    /**
     * Verifies background service and battery optimization permissions.
     * 
     * @param context Application context
     * @return Boolean indicating if background permissions are granted
     */
    fun checkBackgroundPermissions(context: Context): Boolean {
        val hasBackgroundService = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.FOREGROUND_SERVICE
            ) == PackageManager.PERMISSION_GRANTED
        } else true

        val hasNotificationPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else true

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val isBatteryOptimizationExempt = powerManager.isIgnoringBatteryOptimizations(context.packageName)

        Log.d(TAG, "Background permissions check - Service: $hasBackgroundService, " +
                   "Notifications: $hasNotificationPermission, " +
                   "Battery Optimization Exempt: $isBatteryOptimizationExempt")

        return hasBackgroundService && hasNotificationPermission && isBatteryOptimizationExempt
    }

    /**
     * Requests audio recording permissions with enhanced user experience.
     * 
     * @param activity Activity context for permission requests
     */
    fun requestAudioPermissions(activity: Activity) {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            permissionsToRequest.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }

        if (permissionsToRequest.isNotEmpty()) {
            Log.d(TAG, "Requesting audio permissions: ${permissionsToRequest.joinToString()}")
            ActivityCompat.requestPermissions(
                activity,
                permissionsToRequest.toTypedArray(),
                PERMISSION_REQUEST_CODE_AUDIO
            )
        }
    }

    /**
     * Requests background service permissions with battery optimization handling.
     * 
     * @param activity Activity context for permission requests
     */
    fun requestBackgroundPermissions(activity: Activity) {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.FOREGROUND_SERVICE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            permissionsToRequest.add(Manifest.permission.FOREGROUND_SERVICE)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (permissionsToRequest.isNotEmpty()) {
            Log.d(TAG, "Requesting background permissions: ${permissionsToRequest.joinToString()}")
            ActivityCompat.requestPermissions(
                activity,
                permissionsToRequest.toTypedArray(),
                PERMISSION_REQUEST_CODE_BACKGROUND
            )
        }
    }

    /**
     * Determines if permission explanation should be shown to the user.
     * 
     * @param activity Activity context for permission checks
     * @param permission The permission to check
     * @return Boolean indicating if rationale should be shown
     */
    fun shouldShowPermissionRationale(activity: Activity, permission: String): Boolean {
        val shouldShow = ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
        Log.d(TAG, "Should show rationale for $permission: $shouldShow")
        return shouldShow
    }

    /**
     * Checks if all required permissions are granted.
     * 
     * @param context Application context
     * @return Boolean indicating if all permissions are granted
     */
    private fun areAllPermissionsGranted(context: Context): Boolean {
        return REQUIRED_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
}