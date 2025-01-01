package com.babycryanalyzer.audio

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.babycryanalyzer.utils.AudioUtils
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import java.util.concurrent.atomic.AtomicBoolean

/**
 * React Native native module that provides audio capture functionality for the Baby Cry Analyzer.
 * Implements real-time audio processing with noise filtering and efficient resource management.
 *
 * @version 1.0
 */
@AndroidEntryPoint
class AudioCaptureModule @Inject constructor(
    reactContext: ReactApplicationContext,
    private val audioProcessor: AudioProcessor,
    private val audioRecorderService: AudioRecorderService
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val MODULE_NAME = "AudioCaptureModule"
        private const val PERMISSION_REQUEST_CODE = 123

        // Event names
        private const val EVENT_AUDIO_DATA = "onAudioData"
        private const val EVENT_ERROR = "onAudioError"
        private const val EVENT_STATE_CHANGE = "onAudioStateChange"
        private const val EVENT_BUFFER_OVERFLOW = "onBufferOverflow"
        private const val EVENT_RESOURCE_ERROR = "onResourceError"
    }

    private val isInitialized = AtomicBoolean(false)
    private val moduleScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var noiseFilterLevel: Float = 0.5f
    private var bufferSize: Int = AudioUtils.calculateBufferSize()

    private val errorHandler = object : AudioErrorHandler {
        override fun onError(error: AudioRecorderService.AudioError, exception: Exception?) {
            val params = Arguments.createMap().apply {
                putString("type", error.name)
                putString("message", exception?.message ?: "Unknown error")
            }
            sendEvent(EVENT_ERROR, params)
        }
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Initializes audio capture with specified configuration.
     *
     * @param config Configuration parameters for audio capture
     * @param promise Promise to resolve/reject based on initialization result
     */
    @ReactMethod
    fun startAudioCapture(config: ReadableMap, promise: Promise) {
        moduleScope.launch {
            try {
                if (!checkAndRequestPermissions(promise)) {
                    return@launch
                }

                // Configure audio processing
                bufferSize = config.getInt("bufferSize").takeIf { it > 0 }
                    ?: AudioUtils.calculateBufferSize()
                noiseFilterLevel = config.getDouble("noiseFilterLevel")
                    .toFloat().coerceIn(0f, 1f)

                // Initialize components
                if (!initialize()) {
                    promise.reject("INIT_ERROR", "Failed to initialize audio capture")
                    return@launch
                }

                // Start recording
                if (audioRecorderService.startRecording()) {
                    setupStateListener()
                    isInitialized.set(true)
                    promise.resolve(null)
                } else {
                    promise.reject("START_ERROR", "Failed to start audio recording")
                }

            } catch (e: Exception) {
                promise.reject("CAPTURE_ERROR", e)
                sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                    putString("type", "INITIALIZATION_ERROR")
                    putString("message", e.message)
                })
            }
        }
    }

    /**
     * Stops audio capture and releases resources.
     *
     * @param promise Promise to resolve/reject based on stop operation result
     */
    @ReactMethod
    fun stopAudioCapture(promise: Promise) {
        moduleScope.launch {
            try {
                if (!isInitialized.get()) {
                    promise.resolve(null)
                    return@launch
                }

                audioRecorderService.stopRecording()
                audioProcessor.stopProcessing()
                isInitialized.set(false)
                promise.resolve(null)

            } catch (e: Exception) {
                promise.reject("STOP_ERROR", e)
                sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                    putString("type", "STOP_ERROR")
                    putString("message", e.message)
                })
            }
        }
    }

    /**
     * Updates noise filter sensitivity level.
     *
     * @param level New noise filter level (0.0 to 1.0)
     * @param promise Promise to resolve/reject based on update result
     */
    @ReactMethod
    fun setNoiseFilterLevel(level: Double, promise: Promise) {
        try {
            noiseFilterLevel = level.toFloat().coerceIn(0f, 1f)
            audioProcessor.setNoiseFilterLevel(noiseFilterLevel)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("FILTER_ERROR", e)
        }
    }

    private fun initialize(): Boolean {
        try {
            // Configure audio processor
            audioProcessor.apply {
                setNoiseFilterLevel(noiseFilterLevel)
                startProcessing()
            }

            return true
        } catch (e: Exception) {
            errorHandler.onError(AudioRecorderService.AudioError.INITIALIZATION_ERROR, e)
            return false
        }
    }

    private suspend fun setupStateListener() {
        moduleScope.launch {
            audioRecorderService.recordingState.collect { state ->
                val params = Arguments.createMap().apply {
                    putString("state", state.toString())
                }
                sendEvent(EVENT_STATE_CHANGE, params)
            }
        }
    }

    @Synchronized
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
    }

    private fun checkAndRequestPermissions(promise: Promise): Boolean {
        val activity = currentActivity as? PermissionAwareActivity ?: run {
            promise.reject("PERMISSION_ERROR", "Activity not found")
            return false
        }

        if (ContextCompat.checkSelfPermission(
                reactApplicationContext,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            activity.requestPermissions(
                arrayOf(Manifest.permission.RECORD_AUDIO),
                PERMISSION_REQUEST_CODE
            ) { requestCode, _, grantResults ->
                if (requestCode == PERMISSION_REQUEST_CODE) {
                    if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                        promise.resolve(true)
                    } else {
                        promise.reject("PERMISSION_DENIED", "Audio recording permission denied")
                    }
                }
            }
            return false
        }
        return true
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        moduleScope.cancel()
        if (isInitialized.get()) {
            audioRecorderService.stopRecording()
            audioProcessor.stopProcessing()
        }
    }
}