package com.babycryanalyzer.notification

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package implementation that registers the NotificationModule,
 * providing a bridge between React Native and Android native notification capabilities.
 *
 * React Native Bridge version: 0.71.0
 * Firebase Messaging version: 23.0.0
 */
class NotificationPackage : ReactPackage {

    /**
     * Creates and returns a list of native modules to register with React Native,
     * specifically the NotificationModule instance.
     *
     * @param reactContext The React Native application context
     * @return List of native modules containing the NotificationModule
     */
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): MutableList<NativeModule> {
        // Validate context
        requireNotNull(reactContext) { "ReactApplicationContext cannot be null" }

        // Create list with initial capacity of 1 for efficiency
        return mutableListOf<NativeModule>().apply {
            // Add NotificationModule instance with dependency injection
            add(
                NotificationModule(
                    reactContext = reactContext,
                    notificationService = NotificationService(
                        context = reactContext,
                        config = object : NotificationConfig {
                            override fun onTokenRefresh(token: String) {
                                // Token refresh handling is managed within NotificationModule
                            }
                        }
                    ),
                    notificationMetrics = object : NotificationMetrics {
                        override fun trackNotificationStart(category: NotificationCategory) {}
                        override fun trackNotificationSuccess(notificationId: Int) {}
                        override fun trackCancellation(notificationId: Int) {}
                        override fun trackTokenRefresh(success: Boolean) {}
                        override fun trackError(error: Exception) {}
                    },
                    errorHandler = object : ErrorHandler {
                        override fun handleError(error: Exception) {
                            // Error handling is managed within NotificationModule
                        }
                    }
                )
            )
        }
    }

    /**
     * Creates and returns an empty list of view managers as notification functionality
     * doesn't require custom views.
     *
     * @param reactContext The React Native application context
     * @return Empty list as no view managers are needed
     */
    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): MutableList<ViewManager<*, *>> {
        // Return empty list since notification functionality doesn't require custom views
        return mutableListOf()
    }
}