package com.babycryanalyzer.background

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.babycryanalyzer.audio.AudioProcessor
import com.babycryanalyzer.notification.NotificationService
import com.babycryanalyzer.notification.NotificationCategory
import com.babycryanalyzer.notification.NotificationData
import com.babycryanalyzer.utils.PermissionUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import javax.inject.Inject
import kotlin.system.exitProcess

/**
 * Background service for continuous cry monitoring with battery optimization and error handling.
 * Implements real-time audio processing and pattern detection in the background.
 *
 * @version 1.0
 */
@AndroidEntryPoint
class BackgroundMonitoringService : Service() {

    companion object {
        private const val TAG = "BackgroundMonitorService"
        private const val NOTIFICATION_ID = 1001
        private const val SERVICE_CHANNEL_ID = "background_monitoring"
        private const val WAKE_LOCK_TAG = "BabyCryAnalyzer:BackgroundMonitoring"
        private const val DEFAULT_PROCESSING_INTERVAL = 500L
        private const val MAX_PROCESSING_INTERVAL = 2000L
    }

    @Inject
    lateinit var audioProcessor: AudioProcessor

    @Inject
    lateinit var notificationService: NotificationService

    private var wakeLock: PowerManager.WakeLock? = null
    private var processingInterval = DEFAULT_PROCESSING_INTERVAL
    private var isMonitoring = false

    private val monitoringScope = CoroutineScope(
        Dispatchers.Default + SupervisorJob() + 
        CoroutineExceptionHandler { _, throwable ->
            Log.e(TAG, "Error in monitoring coroutine", throwable)
            handleMonitoringError(throwable)
        }
    )

    private val batteryOptimizer = object {
        private var consecutiveNonDetections = 0
        private const val OPTIMIZATION_THRESHOLD = 10
        private const val INTERVAL_INCREASE_STEP = 100L

        fun adjustInterval(cryDetected: Boolean) {
            if (!cryDetected) {
                consecutiveNonDetections++
                if (consecutiveNonDetections >= OPTIMIZATION_THRESHOLD) {
                    processingInterval = (processingInterval + INTERVAL_INCREASE_STEP)
                        .coerceAtMost(MAX_PROCESSING_INTERVAL)
                    audioProcessor.setProcessingInterval(processingInterval)
                }
            } else {
                consecutiveNonDetections = 0
                processingInterval = DEFAULT_PROCESSING_INTERVAL
                audioProcessor.setProcessingInterval(processingInterval)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        initializeWakeLock()
        initializeNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service starting with flags: $flags")

        if (!checkAndRequestPermissions()) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundService()
        startMonitoring()

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopMonitoring()
        releaseWakeLock()
        monitoringScope.cancel()
        super.onDestroy()
    }

    private fun initializeWakeLock() {
        try {
            val powerManager = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                WAKE_LOCK_TAG
            ).apply {
                setReferenceCounted(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing wake lock", e)
        }
    }

    private fun initializeNotificationChannel() {
        notificationService.createNotificationChannel(
            SERVICE_CHANNEL_ID,
            "Background Monitoring",
            "Continuous monitoring for baby cries"
        )
    }

    private fun startForegroundService() {
        val notification = NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setContentTitle("Baby Cry Analyzer")
            .setContentText("Monitoring active")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun startMonitoring() {
        if (isMonitoring) return

        try {
            wakeLock?.acquire(10*60*1000L) // 10 minutes timeout
            isMonitoring = true
            
            audioProcessor.startProcessing()
            monitoringScope.launch {
                while (isMonitoring) {
                    try {
                        processAudioFrame()
                        delay(processingInterval)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing audio frame", e)
                        handleMonitoringError(e)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting monitoring", e)
            stopSelf()
        }
    }

    private suspend fun processAudioFrame() {
        val result = audioProcessor.processAudioFrame(ShortArray(1024)) // Frame size from AudioUtils
        
        if (result.isCryDetected && result.confidence > 0.85f) {
            notifyDetection(result.confidence)
            batteryOptimizer.adjustInterval(true)
        } else {
            batteryOptimizer.adjustInterval(false)
        }

        updateNotification(result.confidence)
    }

    private fun stopMonitoring() {
        isMonitoring = false
        audioProcessor.stopProcessing()
        releaseWakeLock()
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing wake lock", e)
        }
    }

    private fun checkAndRequestPermissions(): Boolean {
        return PermissionUtils.checkAudioPermissions(this) &&
               PermissionUtils.checkBackgroundPermissions(this)
    }

    private fun notifyDetection(confidence: Float) {
        notificationService.showNotification(
            title = "Cry Detected",
            message = "Baby might need attention (Confidence: ${(confidence * 100).toInt()}%)",
            category = NotificationCategory.CRY_DETECTION,
            data = NotificationData(
                timestamp = System.currentTimeMillis(),
                metadata = mapOf("confidence" to confidence.toString())
            )
        )
    }

    private fun updateNotification(confidence: Float) {
        notificationService.updateNotification(
            NOTIFICATION_ID,
            "Monitoring Active",
            "Last confidence: ${(confidence * 100).toInt()}%"
        )
    }

    private fun handleMonitoringError(error: Throwable) {
        Log.e(TAG, "Critical monitoring error", error)
        stopMonitoring()
        notificationService.showNotification(
            title = "Monitoring Error",
            message = "Background monitoring stopped due to an error",
            category = NotificationCategory.GENERAL,
            data = NotificationData(
                timestamp = System.currentTimeMillis(),
                metadata = mapOf("error" to error.message.toString())
            )
        )
        stopSelf()
    }
}