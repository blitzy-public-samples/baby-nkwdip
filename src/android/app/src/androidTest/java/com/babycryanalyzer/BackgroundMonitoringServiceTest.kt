package com.babycryanalyzer

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.ServiceTestRule
import com.babycryanalyzer.audio.AudioProcessor
import com.babycryanalyzer.background.BackgroundMonitoringService
import com.babycryanalyzer.utils.AudioUtils
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.*
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class BackgroundMonitoringServiceTest {

    companion object {
        private const val TIMEOUT_SECONDS = 5L
        private const val PATTERN_CONFIDENCE_THRESHOLD = 0.90f
        private const val MONITORING_DURATION_MS = 30000L
        private const val TEST_NOTIFICATION_CHANNEL = "background_monitoring"
    }

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @get:Rule
    val serviceRule = ServiceTestRule()

    private lateinit var mockAudioProcessor: AudioProcessor
    private lateinit var testContext: Context
    private lateinit var notificationManager: NotificationManager
    private lateinit var powerManager: PowerManager
    private lateinit var wakeLock: PowerManager.WakeLock

    @Before
    fun setUp() {
        hiltRule.inject()
        
        testContext = InstrumentationRegistry.getInstrumentation().targetContext
        notificationManager = testContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        powerManager = testContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        
        // Setup mock audio processor
        mockAudioProcessor = mock {
            on { processAudioFrame(any()) } doReturn AudioProcessor.AudioAnalysisResult(
                isCryDetected = false,
                confidence = 0.0f,
                features = mapOf("rmsLevel" to 0.0f),
                timestamp = System.currentTimeMillis()
            )
        }

        // Setup wake lock mock
        wakeLock = mock {
            on { isHeld } doReturn false
        }

        // Clear existing notifications
        notificationManager.cancelAll()
    }

    @Test
    fun testServiceStartup() {
        // Prepare service intent
        val serviceIntent = Intent(testContext, BackgroundMonitoringService::class.java)
        
        // Start service
        val serviceBinder = serviceRule.bindService(serviceIntent)
        
        // Verify service initialization
        verify(mockAudioProcessor, timeout(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))).startProcessing()
        
        // Verify notification channel creation
        val channel = notificationManager.getNotificationChannel(TEST_NOTIFICATION_CHANNEL)
        assert(channel != null) { "Notification channel should be created" }
        
        // Verify foreground notification
        val activeNotifications = notificationManager.activeNotifications
        assert(activeNotifications.isNotEmpty()) { "Foreground notification should be active" }
        assert(activeNotifications[0].notification.channelId == TEST_NOTIFICATION_CHANNEL)
    }

    @Test
    fun testBackgroundMonitoring() {
        // Configure mock audio processor for pattern detection
        val testFrames = generateTestAudioFrames()
        var frameIndex = 0
        
        whenever(mockAudioProcessor.processAudioFrame(any())) doAnswer { invocation ->
            val confidence = if (frameIndex < testFrames.size) testFrames[frameIndex++] else 0.0f
            AudioProcessor.AudioAnalysisResult(
                isCryDetected = confidence > PATTERN_CONFIDENCE_THRESHOLD,
                confidence = confidence,
                features = mapOf("rmsLevel" to confidence),
                timestamp = System.currentTimeMillis()
            )
        }

        // Start monitoring service
        val serviceIntent = Intent(testContext, BackgroundMonitoringService::class.java)
        serviceRule.startService(serviceIntent)

        // Verify continuous monitoring
        verify(mockAudioProcessor, timeout(MONITORING_DURATION_MS).atLeast(5)).processAudioFrame(any())
        
        // Verify pattern detection accuracy
        val detectedPatterns = mutableListOf<Float>()
        verify(mockAudioProcessor, atLeast(10)).processAudioFrame(any())
        
        // Verify learning speed metrics
        val confidenceProgression = detectedPatterns.windowed(5) { window ->
            window.average()
        }
        assert(confidenceProgression.last() > confidenceProgression.first()) {
            "Pattern detection confidence should improve over time"
        }
    }

    @Test
    fun testServiceShutdown() {
        // Start and then stop service
        val serviceIntent = Intent(testContext, BackgroundMonitoringService::class.java)
        val serviceBinder = serviceRule.bindService(serviceIntent)
        
        // Verify initial state
        verify(mockAudioProcessor, timeout(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))).startProcessing()
        
        // Stop service
        serviceRule.unbindService()
        
        // Verify cleanup
        verify(mockAudioProcessor, timeout(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))).stopProcessing()
        verify(mockAudioProcessor).release()
        
        // Verify notification removal
        val activeNotifications = notificationManager.activeNotifications
        assert(activeNotifications.isEmpty()) { "All notifications should be removed on shutdown" }
        
        // Verify wake lock release
        if (::wakeLock.isInitialized && wakeLock.isHeld) {
            verify(wakeLock, timeout(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))).release()
        }
    }

    private fun generateTestAudioFrames(): List<Float> {
        // Generate test data simulating increasing detection confidence
        return List(100) { index ->
            val baseConfidence = index / 100f
            val noise = (Math.random() * 0.1 - 0.05).toFloat()
            (baseConfidence + noise).coerceIn(0f, 1f)
        }
    }
}