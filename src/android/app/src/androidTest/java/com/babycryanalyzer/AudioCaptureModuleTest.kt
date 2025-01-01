package com.babycryanalyzer

import android.Manifest
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.GrantPermissionRule
import com.babycryanalyzer.audio.AudioCaptureModule
import com.babycryanalyzer.audio.AudioProcessor
import com.babycryanalyzer.audio.AudioRecorderService
import com.babycryanalyzer.utils.AudioUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.*
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Comprehensive instrumented test suite for AudioCaptureModule.
 * Validates audio capture, processing, and React Native bridge functionality.
 *
 * @version 1.0
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class AudioCaptureModuleTest {

    companion object {
        private const val TIMEOUT_MS = 5000L
        private const val TEST_BUFFER_SIZE = 4096
        private const val NOISE_THRESHOLD_DB = -60.0f
    }

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @get:Rule
    val permissionRule: GrantPermissionRule = GrantPermissionRule.grant(
        Manifest.permission.RECORD_AUDIO
    )

    private lateinit var audioCaptureModule: AudioCaptureModule
    private lateinit var mockReactContext: ReactApplicationContext
    private lateinit var mockAudioProcessor: AudioProcessor
    private lateinit var mockRecorderService: AudioRecorderService
    private lateinit var mockEventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter
    private lateinit var recordingStateFlow: MutableStateFlow<AudioRecorderService.RecordingState>

    @Before
    fun setup() {
        hiltRule.inject()

        // Initialize mocks
        mockReactContext = mockk(relaxed = true)
        mockAudioProcessor = mockk(relaxed = true)
        mockRecorderService = mockk(relaxed = true)
        mockEventEmitter = mockk(relaxed = true)
        recordingStateFlow = MutableStateFlow(AudioRecorderService.RecordingState.Idle)

        // Setup React Native context
        every { mockReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java) } returns mockEventEmitter
        
        // Setup recorder service
        every { mockRecorderService.recordingState } returns recordingStateFlow
        every { mockRecorderService.startRecording() } returns true
        every { mockRecorderService.getRecordingMetrics() } returns mapOf("StartTime" to System.nanoTime())

        // Initialize module under test
        audioCaptureModule = AudioCaptureModule(
            mockReactContext,
            mockAudioProcessor,
            mockRecorderService
        )
    }

    @Test
    fun testAudioCaptureStart() {
        // Setup test configuration
        val configMap = JavaOnlyMap().apply {
            putInt("bufferSize", TEST_BUFFER_SIZE)
            putDouble("noiseFilterLevel", NOISE_THRESHOLD_DB.toDouble())
        }
        val latch = CountDownLatch(1)

        // Execute start capture
        audioCaptureModule.startAudioCapture(configMap, object : com.facebook.react.bridge.Promise {
            override fun resolve(value: Any?) {
                latch.countDown()
            }
            override fun reject(code: String?, message: String?) {
                fail("Audio capture start failed: $message")
            }
        })

        // Verify initialization and start sequence
        verify(exactly = 1) {
            mockAudioProcessor.setNoiseFilterLevel(NOISE_THRESHOLD_DB)
            mockAudioProcessor.startProcessing()
            mockRecorderService.startRecording()
        }

        // Verify state transition
        assert(latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS))
        verify(exactly = 1) {
            mockEventEmitter.emit("onAudioStateChange", any<JavaOnlyMap>())
        }
    }

    @Test
    fun testAudioCaptureStop() {
        // Setup recording state
        recordingStateFlow.value = AudioRecorderService.RecordingState.Recording
        val latch = CountDownLatch(1)

        // Execute stop capture
        audioCaptureModule.stopAudioCapture(object : com.facebook.react.bridge.Promise {
            override fun resolve(value: Any?) {
                latch.countDown()
            }
            override fun reject(code: String?, message: String?) {
                fail("Audio capture stop failed: $message")
            }
        })

        // Verify cleanup sequence
        verify(exactly = 1) {
            mockRecorderService.stopRecording()
            mockAudioProcessor.stopProcessing()
        }

        // Verify state transition
        assert(latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS))
        verify(exactly = 1) {
            mockEventEmitter.emit("onAudioStateChange", match { 
                it.getMap("state")?.getString("state") == "Idle"
            })
        }
    }

    @Test
    fun testNoiseFilterConfiguration() {
        val testLevel = 0.75
        val latch = CountDownLatch(1)

        // Execute noise filter update
        audioCaptureModule.setNoiseFilterLevel(testLevel, object : com.facebook.react.bridge.Promise {
            override fun resolve(value: Any?) {
                latch.countDown()
            }
            override fun reject(code: String?, message: String?) {
                fail("Noise filter configuration failed: $message")
            }
        })

        // Verify filter update
        verify(exactly = 1) {
            mockAudioProcessor.setNoiseFilterLevel(testLevel.toFloat())
        }
        assert(latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS))
    }

    @Test
    fun testErrorHandling() {
        // Setup error scenario
        every { mockRecorderService.startRecording() } throws IllegalStateException("Audio device busy")
        val latch = CountDownLatch(1)

        // Execute with expected failure
        audioCaptureModule.startAudioCapture(JavaOnlyMap(), object : com.facebook.react.bridge.Promise {
            override fun resolve(value: Any?) {
                fail("Should have failed with error")
            }
            override fun reject(code: String?, message: String?) {
                assertEquals("CAPTURE_ERROR", code)
                latch.countDown()
            }
        })

        // Verify error handling
        assert(latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS))
        verify(exactly = 1) {
            mockEventEmitter.emit("onAudioError", match {
                it.getString("type") == "INITIALIZATION_ERROR"
            })
        }
    }

    @Test
    fun testResourceCleanup() {
        // Setup module for cleanup test
        val configMap = JavaOnlyMap().apply {
            putInt("bufferSize", TEST_BUFFER_SIZE)
            putDouble("noiseFilterLevel", NOISE_THRESHOLD_DB.toDouble())
        }

        // Start and then destroy
        audioCaptureModule.startAudioCapture(configMap, mockk(relaxed = true))
        audioCaptureModule.onCatalystInstanceDestroy()

        // Verify cleanup sequence
        verify(exactly = 1) {
            mockRecorderService.stopRecording()
            mockAudioProcessor.stopProcessing()
        }
    }

    private fun fail(message: String) {
        throw AssertionError(message)
    }
}