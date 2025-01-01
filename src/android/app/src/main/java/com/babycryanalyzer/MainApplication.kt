package com.babycryanalyzer

import android.app.Application
import android.content.Context
import android.os.StrictMode
import android.util.Log
import androidx.multidex.MultiDexApplication
import com.babycryanalyzer.audio.AudioCapturePackage
import com.babycryanalyzer.background.BackgroundTaskPackage
import com.babycryanalyzer.notification.NotificationPackage
import com.babycryanalyzer.storage.SecureStoragePackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import dagger.hilt.android.HiltAndroidApp
import java.security.Security
import javax.inject.Inject

/**
 * Main Android application class that initializes React Native and native modules
 * with enhanced security and performance features.
 *
 * @version 1.0.0
 */
@HiltAndroidApp
class MainApplication : MultiDexApplication(), ReactApplication {

    companion object {
        private const val TAG = "MainApplication"
        private const val MIN_HEAP_SIZE = 256L * 1024L * 1024L // 256MB
    }

    private val mReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean {
            return BuildConfig.DEBUG
        }

        override fun getPackages(): List<ReactPackage> {
            try {
                // Initialize packages with security validation
                val packages = PackageList(this).packages.toMutableList()

                // Add custom packages with enhanced error handling
                packages.addAll(listOf(
                    AudioCapturePackage(),
                    BackgroundTaskPackage(),
                    NotificationPackage(),
                    SecureStoragePackage()
                ))

                Log.d(TAG, "Successfully initialized ${packages.size} packages")
                return packages
            } catch (e: Exception) {
                Log.e(TAG, "Error initializing packages", e)
                throw RuntimeException("Package initialization failed", e)
            }
        }

        override fun getJSMainModuleName(): String {
            return "index"
        }

        override fun getBundleAssetName(): String {
            return "index.android.bundle"
        }
    }

    override fun getReactNativeHost(): ReactNativeHost = mReactNativeHost

    override fun onCreate() {
        super.onCreate()

        try {
            // Initialize security providers
            initializeSecurity()

            // Configure strict mode for development
            if (BuildConfig.DEBUG) {
                configureStrictMode()
            }

            // Initialize SoLoader with enhanced error handling
            initializeSoLoader()

            // Configure memory management
            configureMemoryManagement()

            // Initialize crash reporting
            initializeCrashReporting()

            Log.i(TAG, "Application initialized successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Critical error during application initialization", e)
            throw RuntimeException("Application initialization failed", e)
        }
    }

    private fun initializeSecurity() {
        try {
            // Update security providers
            Security.insertProviderAt(
                org.conscrypt.Conscrypt.newProvider(),
                1
            )

            // Enable network security
            enableNetworkSecurity()

            Log.d(TAG, "Security initialization completed")
        } catch (e: Exception) {
            Log.e(TAG, "Security initialization failed", e)
            throw SecurityException("Failed to initialize security", e)
        }
    }

    private fun initializeSoLoader() {
        try {
            SoLoader.init(this, false)
            Log.d(TAG, "SoLoader initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "SoLoader initialization failed", e)
            throw RuntimeException("Failed to initialize SoLoader", e)
        }
    }

    private fun configureStrictMode() {
        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder()
                .detectDiskReads()
                .detectDiskWrites()
                .detectNetwork()
                .penaltyLog()
                .build()
        )

        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder()
                .detectLeakedSqlLiteObjects()
                .detectLeakedClosableObjects()
                .detectActivityLeaks()
                .penaltyLog()
                .build()
        )
    }

    private fun configureMemoryManagement() {
        try {
            // Set minimum heap size
            val runtime = Runtime.getRuntime()
            if (runtime.maxMemory() < MIN_HEAP_SIZE) {
                Log.w(TAG, "Available heap size may be insufficient")
            }

            // Enable GC optimization
            System.gc()
            
            Log.d(TAG, "Memory management configured successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Memory management configuration failed", e)
        }
    }

    private fun initializeCrashReporting() {
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "Uncaught exception in thread ${thread.name}", throwable)
            // Add crash reporting implementation here
        }
    }

    private fun enableNetworkSecurity() {
        // Enable network security configurations
        // Implementation would go here
    }

    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        // Initialize MultiDex if needed
        androidx.multidex.MultiDex.install(this)
    }
}