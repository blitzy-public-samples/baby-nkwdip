package com.babycryanalyzer.notification

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import javax.inject.Inject
import dagger.hilt.android.AndroidEntryPoint
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Enhanced React Native module providing comprehensive notification functionality
 * for the Baby Cry Analyzer application.
 *
 * @property notificationService Service handling notification operations
 * @property notificationMetrics Metrics tracking for notifications
 * @property errorHandler Error handling and recovery
 *
 * React Native Bridge version: 0.71.0
 * Firebase Messaging version: 23.0.0
 * Hilt version: 2.44
 */
@AndroidEntryPoint
class NotificationModule @Inject constructor(
    reactContext: ReactApplicationContext,
    private val notificationService: NotificationService,
    private val notificationMetrics: NotificationMetrics,
    private val errorHandler: ErrorHandler
) : ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.Main)
    private val TAG = "NotificationModule"

    companion object {
        private const val MAX_RETRIES = 3
        private const val BASE_RETRY_DELAY = 1000L
    }

    override fun getName(): String = "NotificationModule"

    /**
     * Shows an enhanced notification with rich content and delivery tracking.
     *
     * @param title Notification title
     * @param message Notification message
     * @param data Additional notification configuration
     * @param promise Promise to resolve with notification result
     */
    @ReactMethod
    fun showNotification(
        title: String,
        message: String,
        data: ReadableMap,
        promise: Promise
    ) {
        scope.launch {
            try {
                // Validate input parameters
                if (title.isEmpty() || message.isEmpty()) {
                    throw IllegalArgumentException("Title and message are required")
                }

                // Convert ReadableMap to NotificationData
                val notificationData = NotificationData(
                    longText = data.getString("longText"),
                    timestamp = System.currentTimeMillis(),
                    metadata = data.toHashMap().mapValues { it.value.toString() }
                )

                // Determine notification category based on confidence
                val category = when (data.getDouble("confidence")) {
                    in 0.8..1.0 -> NotificationCategory.CRY_DETECTION
                    in 0.5..0.79 -> NotificationCategory.ANALYSIS_RESULT
                    else -> NotificationCategory.GENERAL
                }

                // Create notification actions
                val actions = createNotificationActions(data)

                // Show notification and track metrics
                val notificationId = withContext(Dispatchers.IO) {
                    notificationMetrics.trackNotificationStart(category)
                    notificationService.showNotification(
                        title = title,
                        message = message,
                        category = category,
                        data = notificationData,
                        actions = actions
                    )
                }

                // Track successful delivery
                notificationMetrics.trackNotificationSuccess(notificationId)

                // Resolve promise with rich response
                promise.resolve(createSuccessResponse(notificationId, category))
            } catch (e: Exception) {
                handleNotificationError(e, promise)
            }
        }
    }

    /**
     * Cancels a notification with cleanup and metric tracking.
     *
     * @param notificationId ID of notification to cancel
     * @param promise Promise to resolve with cancellation status
     */
    @ReactMethod
    fun cancelNotification(notificationId: Int, promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    notificationMetrics.trackCancellation(notificationId)
                    notificationService.cancelNotification(notificationId)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                handleNotificationError(e, promise)
            }
        }
    }

    /**
     * Retrieves and manages Firebase Cloud Messaging token with error recovery.
     *
     * @param promise Promise to resolve with FCM token
     */
    @ReactMethod
    fun getFirebaseToken(promise: Promise) {
        scope.launch {
            var retryCount = 0
            var lastException: Exception? = null

            while (retryCount < MAX_RETRIES) {
                try {
                    val tokenResult = withContext(Dispatchers.IO) {
                        notificationService.manageFcmToken().await()
                    }
                    
                    notificationMetrics.trackTokenRefresh(success = true)
                    promise.resolve(createTokenResponse(tokenResult))
                    return@launch
                } catch (e: FirebaseMessagingException) {
                    lastException = e
                    retryCount++
                    
                    if (retryCount < MAX_RETRIES) {
                        delay(BASE_RETRY_DELAY * (1 shl (retryCount - 1)))
                    }
                }
            }

            notificationMetrics.trackTokenRefresh(success = false)
            handleNotificationError(lastException ?: Exception("Token retrieval failed"), promise)
        }
    }

    private fun createNotificationActions(data: ReadableMap): List<NotificationAction> {
        val actions = mutableListOf<NotificationAction>()
        
        if (data.hasKey("actions")) {
            val actionsArray = data.getArray("actions")
            actionsArray?.let {
                for (i in 0 until it.size()) {
                    val actionMap = it.getMap(i)
                    actions.add(NotificationAction(
                        title = actionMap.getString("title") ?: "",
                        icon = actionMap.getInt("icon"),
                        intent = createActionIntent(actionMap)
                    ))
                }
            }
        }
        
        return actions
    }

    private fun createActionIntent(actionMap: ReadableMap): android.content.Intent {
        return android.content.Intent().apply {
            action = actionMap.getString("action")
            putExtra("notificationId", actionMap.getInt("notificationId"))
            putExtra("actionType", actionMap.getString("type"))
        }
    }

    private fun createSuccessResponse(notificationId: Int, category: NotificationCategory): ReadableMap {
        return Arguments.createMap().apply {
            putInt("notificationId", notificationId)
            putString("category", category.name)
            putBoolean("success", true)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
    }

    private fun createTokenResponse(token: String): ReadableMap {
        return Arguments.createMap().apply {
            putString("token", token)
            putBoolean("valid", true)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            putInt("expiresIn", 604800) // 7 days in seconds
        }
    }

    private fun handleNotificationError(error: Exception, promise: Promise) {
        Log.e(TAG, "Notification error: ${error.message}", error)
        errorHandler.handleError(error)
        notificationMetrics.trackError(error)
        
        promise.reject(
            when (error) {
                is IllegalArgumentException -> "INVALID_PARAMS"
                is FirebaseMessagingException -> "FCM_ERROR"
                else -> "UNKNOWN_ERROR"
            },
            error.message,
            error
        )
    }
}

/**
 * Metrics tracking interface for notification events
 */
interface NotificationMetrics {
    fun trackNotificationStart(category: NotificationCategory)
    fun trackNotificationSuccess(notificationId: Int)
    fun trackCancellation(notificationId: Int)
    fun trackTokenRefresh(success: Boolean)
    fun trackError(error: Exception)
}

/**
 * Error handling interface for notification operations
 */
interface ErrorHandler {
    fun handleError(error: Exception)
}