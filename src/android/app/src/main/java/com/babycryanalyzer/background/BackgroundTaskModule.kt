package com.babycryanalyzer.background

import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * React Native native module that manages background task functionality for the Baby Cry Analyzer.
 * Provides battery-optimized continuous monitoring with comprehensive error handling.
 *
 * @property reactContext React Native application context
 * @property applicationContext Android application context
 * @version 1.0.0
 */
@HiltAndroidApp
class BackgroundTaskModule @Inject constructor(
    reactContext: ReactApplicationContext,
    @ApplicationContext private val applicationContext: Context
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BackgroundTaskModule"
        private const val MODULE_NAME = "BackgroundTaskModule"
        private const val WAKE_LOCK_TIMEOUT = 10 * 60 * 1000L // 10 minutes

        private object ErrorCodes {
            const val SERVICE_START_FAILED = 1001
            const val SERVICE_STOP_FAILED = 1002
            const val BATTERY_OPTIMIZATION_REQUIRED = 1003
            const val INVALID_STATE = 1004
            const val PERMISSION_DENIED = 1005
        }
    }

    private val powerManager: PowerManager by lazy {
        applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    }

    private var isServiceRunning = false
    private var wakeLock: PowerManager.WakeLock? = null

    override fun getName(): String = MODULE_NAME

    /**
     * Starts the background monitoring service with battery optimization checks.
     *
     * @param promise React Native promise for async result handling
     */
    @ReactMethod
    fun startBackgroundTask(promise: Promise) {
        try {
            Log.d(TAG, "Starting background task")

            // Check battery optimization status
            if (!powerManager.isIgnoringBatteryOptimizations(applicationContext.packageName)) {
                Log.w(TAG, "Battery optimization not disabled for app")
                promise.reject(
                    ErrorCodes.BATTERY_OPTIMIZATION_REQUIRED.toString(),
                    "Battery optimization needs to be disabled for reliable monitoring"
                )
                return
            }

            // Create and configure service intent
            val serviceIntent = Intent(applicationContext, BackgroundMonitoringService::class.java).apply {
                action = "START_MONITORING"
            }

            // Acquire wake lock for reliable background processing
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "BabyCryAnalyzer:BackgroundTask"
            ).apply {
                setReferenceCounted(false)
                acquire(WAKE_LOCK_TIMEOUT)
            }

            // Start the service
            applicationContext.startForegroundService(serviceIntent)
            isServiceRunning = true

            Log.d(TAG, "Background task started successfully")
            promise.resolve(true)

        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied starting background task", e)
            promise.reject(
                ErrorCodes.PERMISSION_DENIED.toString(),
                "Required permissions not granted",
                e
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error starting background task", e)
            promise.reject(
                ErrorCodes.SERVICE_START_FAILED.toString(),
                "Failed to start background task: ${e.message}",
                e
            )
        }
    }

    /**
     * Stops the background monitoring service and performs cleanup.
     *
     * @param promise React Native promise for async result handling
     */
    @ReactMethod
    fun stopBackgroundTask(promise: Promise) {
        try {
            Log.d(TAG, "Stopping background task")

            // Release wake lock if held
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
            wakeLock = null

            // Stop the service
            val serviceIntent = Intent(applicationContext, BackgroundMonitoringService::class.java)
            applicationContext.stopService(serviceIntent)
            isServiceRunning = false

            Log.d(TAG, "Background task stopped successfully")
            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Error stopping background task", e)
            promise.reject(
                ErrorCodes.SERVICE_STOP_FAILED.toString(),
                "Failed to stop background task: ${e.message}",
                e
            )
        }
    }

    /**
     * Checks if the background monitoring service is currently running.
     *
     * @param promise React Native promise for async result handling
     */
    @ReactMethod
    fun isBackgroundTaskRunning(promise: Promise) {
        try {
            val status = mapOf(
                "isRunning" to isServiceRunning,
                "isBatteryOptimized" to !powerManager.isIgnoringBatteryOptimizations(applicationContext.packageName),
                "hasWakeLock" to (wakeLock?.isHeld ?: false)
            )
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking background task status", e)
            promise.reject(
                ErrorCodes.INVALID_STATE.toString(),
                "Failed to check background task status: ${e.message}",
                e
            )
        }
    }

    override fun onCatalystInstanceDestroy() {
        // Cleanup when React Native context is destroyed
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null
        super.onCatalystInstanceDestroy()
    }
}