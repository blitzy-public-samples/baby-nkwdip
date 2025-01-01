package com.babycryanalyzer.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.RemoteMessage
import com.google.android.gms.tasks.Task
import javax.inject.Injectable
import android.graphics.Color

/**
 * Comprehensive notification service handling all notification-related functionality
 * for the Baby Cry Analyzer application.
 *
 * @property context Application context for system service access
 * @property config Notification configuration settings
 *
 * Firebase Messaging version: 23.0.0
 * AndroidX Core version: 1.5.0
 */
@Injectable
class NotificationService(
    private val context: Context,
    private val config: NotificationConfig
) {
    private val notificationManager: NotificationManager = 
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val firebaseMessaging: FirebaseMessaging = FirebaseMessaging.getInstance()
    private val notificationChannels = mutableMapOf<String, NotificationChannel>()

    // Channel IDs
    companion object {
        const val CHANNEL_HIGH_PRIORITY = "cry_detection_alerts"
        const val CHANNEL_MEDIUM_PRIORITY = "analysis_results"
        const val CHANNEL_LOW_PRIORITY = "general_info"
        
        private var notificationId = 0
        private fun getNextNotificationId() = notificationId++
    }

    init {
        createNotificationChannels()
    }

    /**
     * Creates and configures notification channels for different priority levels.
     * Only creates channels on Android O and above.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // High Priority Channel
            val highPriorityChannel = NotificationChannel(
                CHANNEL_HIGH_PRIORITY,
                "Cry Detection Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Immediate alerts for detected baby cries"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }

            // Medium Priority Channel
            val mediumPriorityChannel = NotificationChannel(
                CHANNEL_MEDIUM_PRIORITY,
                "Analysis Results",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Updates about cry analysis results"
                enableLights(true)
                lightColor = Color.YELLOW
                enableVibration(true)
            }

            // Low Priority Channel
            val lowPriorityChannel = NotificationChannel(
                CHANNEL_LOW_PRIORITY,
                "General Information",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "General app updates and information"
                enableLights(false)
                enableVibration(false)
            }

            // Register all channels
            notificationManager.createNotificationChannels(listOf(
                highPriorityChannel,
                mediumPriorityChannel,
                lowPriorityChannel
            ))

            // Store channels for later use
            notificationChannels[CHANNEL_HIGH_PRIORITY] = highPriorityChannel
            notificationChannels[CHANNEL_MEDIUM_PRIORITY] = mediumPriorityChannel
            notificationChannels[CHANNEL_LOW_PRIORITY] = lowPriorityChannel
        }
    }

    /**
     * Shows a rich notification with the given content and configuration.
     *
     * @param title Notification title
     * @param message Notification message content
     * @param category Notification category determining channel and behavior
     * @param data Additional notification data
     * @param actions List of actions for the notification
     * @return Notification ID for future reference
     */
    fun showNotification(
        title: String,
        message: String,
        category: NotificationCategory,
        data: NotificationData,
        actions: List<NotificationAction> = emptyList()
    ): Int {
        val channelId = when (category) {
            NotificationCategory.CRY_DETECTION -> CHANNEL_HIGH_PRIORITY
            NotificationCategory.ANALYSIS_RESULT -> CHANNEL_MEDIUM_PRIORITY
            NotificationCategory.GENERAL -> CHANNEL_LOW_PRIORITY
        }

        val builder = NotificationCompat.Builder(context, channelId)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)

        // Add actions if provided
        actions.forEach { action ->
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                action.hashCode(),
                action.intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(action.icon, action.title, pendingIntent)
        }

        // Set style for expanded view
        if (data.longText != null) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(data.longText))
        }

        val notificationId = getNextNotificationId()
        notificationManager.notify(notificationId, builder.build())
        return notificationId
    }

    /**
     * Processes incoming FCM messages and creates appropriate notifications.
     *
     * @param message Remote message from Firebase Cloud Messaging
     */
    fun handleFcmMessage(message: RemoteMessage) {
        val data = message.data
        val category = NotificationCategory.valueOf(
            data["category"] ?: NotificationCategory.GENERAL.name
        )
        
        val notificationData = NotificationData(
            longText = data["longText"],
            timestamp = System.currentTimeMillis(),
            metadata = data
        )

        showNotification(
            title = message.notification?.title ?: data["title"] ?: "Baby Cry Analyzer",
            message = message.notification?.body ?: data["message"] ?: "",
            category = category,
            data = notificationData
        )
    }

    /**
     * Manages FCM token lifecycle including refresh and storage.
     *
     * @return Task containing the FCM token
     */
    fun manageFcmToken(): Task<String> {
        return firebaseMessaging.token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                // Store token securely and send to backend
                config.onTokenRefresh(token)
            }
        }
    }
}

/**
 * Notification categories determining channel selection and behavior
 */
enum class NotificationCategory {
    CRY_DETECTION,
    ANALYSIS_RESULT,
    GENERAL
}

/**
 * Data class containing additional notification information
 */
data class NotificationData(
    val longText: String? = null,
    val timestamp: Long,
    val metadata: Map<String, String> = emptyMap()
)

/**
 * Data class representing a notification action
 */
data class NotificationAction(
    val title: String,
    val icon: Int,
    val intent: android.content.Intent
)

/**
 * Configuration interface for notification service
 */
interface NotificationConfig {
    fun onTokenRefresh(token: String)
}