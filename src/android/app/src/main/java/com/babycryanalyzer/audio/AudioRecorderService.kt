package com.babycryanalyzer.audio

import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.AudioFormat
import android.media.audiofx.NoiseSuppressor
import android.media.audiofx.AutomaticGainControl
import android.os.Process
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import com.babycryanalyzer.utils.AudioUtils
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import kotlin.math.max

/**
 * Enterprise-grade audio recording service optimized for baby cry analysis.
 * Implements high-performance audio capture with advanced buffer management,
 * noise reduction, and real-time streaming capabilities.
 *
 * @version 1.0
 */
@AndroidEntryPoint
class AudioRecorderService @Inject constructor(
    private val audioProcessor: AudioProcessor,
    private val errorHandler: AudioErrorHandler
) {
    companion object {
        private const val BUFFER_SIZE_FACTOR = 2
        private const val MIN_BUFFER_SIZE = 4096
        private const val MAX_RETRY_ATTEMPTS = 3
        private const val RECORDING_TIMEOUT_MS = 300000L // 5 minutes
        private const val THREAD_PRIORITY = Process.THREAD_PRIORITY_AUDIO
    }

    private var audioRecord: AudioRecord? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var automaticGainControl: AutomaticGainControl? = null
    private val isRecording = AtomicBoolean(false)
    private val recordingScope = CoroutineScope(
        Dispatchers.Default + SupervisorJob() + 
        CoroutineName("AudioRecorderScope")
    )

    private val _recordingState = MutableStateFlow<RecordingState>(RecordingState.Idle)
    val recordingState: StateFlow<RecordingState> = _recordingState

    private val performanceMonitor = RecordingMetrics()
    private var recordingJob: Job? = null
    private var timeoutJob: Job? = null

    /**
     * Initiates audio recording with optimized parameters and error recovery.
     *
     * @return Boolean indicating success of recording initialization
     */
    @Synchronized
    fun startRecording(): Boolean {
        if (isRecording.get()) {
            return false
        }

        try {
            val bufferSize = max(
                AudioUtils.calculateBufferSize() * BUFFER_SIZE_FACTOR,
                MIN_BUFFER_SIZE
            )

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                AudioUtils.SAMPLE_RATE,
                AudioUtils.CHANNEL_CONFIG,
                AudioUtils.AUDIO_FORMAT,
                bufferSize
            ).apply {
                // Initialize audio effects if supported
                if (NoiseSuppressor.isAvailable()) {
                    noiseSuppressor = NoiseSuppressor.create(audioSessionId)?.apply { enabled = true }
                }
                if (AutomaticGainControl.isAvailable()) {
                    automaticGainControl = AutomaticGainControl.create(audioSessionId)?.apply { enabled = true }
                }
            }

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                throw IllegalStateException("Failed to initialize AudioRecord")
            }

            startRecordingSession()
            return true

        } catch (e: Exception) {
            errorHandler.onError(AudioError.INITIALIZATION_ERROR, e)
            releaseResources()
            return false
        }
    }

    /**
     * Safely stops audio recording with comprehensive resource cleanup.
     */
    @Synchronized
    fun stopRecording() {
        if (!isRecording.get()) {
            return
        }

        isRecording.set(false)
        timeoutJob?.cancel()
        recordingJob?.cancel()
        
        recordingScope.launch {
            try {
                _recordingState.emit(RecordingState.Stopping)
                performanceMonitor.recordMetric("StopTime", System.nanoTime())
                releaseResources()
                _recordingState.emit(RecordingState.Idle)
            } catch (e: Exception) {
                errorHandler.onError(AudioError.CLEANUP_ERROR, e)
            }
        }
    }

    /**
     * Retrieves current recording metrics and performance statistics.
     *
     * @return RecordingMetrics containing performance data
     */
    fun getRecordingMetrics(): Map<String, Any> = performanceMonitor.getMetrics()

    private fun startRecordingSession() {
        recordingScope.launch {
            _recordingState.emit(RecordingState.Starting)
            
            withContext(Dispatchers.Default) {
                Process.setThreadPriority(THREAD_PRIORITY)
                
                val buffer = ShortArray(AudioUtils.calculateFrameSize(AudioUtils.FRAME_SIZE_MS))
                var retryCount = 0

                isRecording.set(true)
                audioRecord?.startRecording()
                
                _recordingState.emit(RecordingState.Recording)
                performanceMonitor.recordMetric("StartTime", System.nanoTime())

                // Start recording timeout monitor
                timeoutJob = launch {
                    delay(RECORDING_TIMEOUT_MS)
                    stopRecording()
                }

                // Main recording loop
                recordingJob = launch {
                    while (isRecording.get()) {
                        try {
                            val readResult = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                            
                            when {
                                readResult > 0 -> {
                                    processAudioData(buffer)
                                    retryCount = 0
                                    performanceMonitor.recordMetric("BufferProcessed", System.nanoTime())
                                }
                                readResult == AudioRecord.ERROR_BAD_VALUE -> {
                                    handleRecordingError(AudioError.INVALID_BUFFER, retryCount++)
                                }
                                readResult == AudioRecord.ERROR_INVALID_OPERATION -> {
                                    handleRecordingError(AudioError.INVALID_STATE, retryCount++)
                                }
                            }
                        } catch (e: Exception) {
                            handleRecordingError(AudioError.RECORDING_ERROR, retryCount++, e)
                        }
                    }
                }
            }
        }
    }

    private suspend fun processAudioData(audioBuffer: ShortArray) {
        withContext(Dispatchers.Default) {
            try {
                audioProcessor.processAudioFrame(audioBuffer)
                performanceMonitor.recordMetric("ProcessingTime", System.nanoTime())
            } catch (e: Exception) {
                errorHandler.onError(AudioError.PROCESSING_ERROR, e)
            }
        }
    }

    private fun handleRecordingError(error: AudioError, retryCount: Int, exception: Exception? = null) {
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
            errorHandler.onError(error, exception)
            stopRecording()
        } else {
            performanceMonitor.recordMetric("ErrorRetry", System.nanoTime())
        }
    }

    private fun releaseResources() {
        try {
            audioRecord?.apply {
                stop()
                release()
            }
            audioRecord = null
            
            noiseSuppressor?.apply {
                enabled = false
                release()
            }
            noiseSuppressor = null
            
            automaticGainControl?.apply {
                enabled = false
                release()
            }
            automaticGainControl = null
            
        } catch (e: Exception) {
            errorHandler.onError(AudioError.RELEASE_ERROR, e)
        }
    }

    sealed class RecordingState {
        object Idle : RecordingState()
        object Starting : RecordingState()
        object Recording : RecordingState()
        object Stopping : RecordingState()
    }

    enum class AudioError {
        INITIALIZATION_ERROR,
        RECORDING_ERROR,
        PROCESSING_ERROR,
        INVALID_BUFFER,
        INVALID_STATE,
        CLEANUP_ERROR,
        RELEASE_ERROR
    }

    private class RecordingMetrics {
        private val metrics = mutableMapOf<String, Any>()
        
        fun recordMetric(key: String, value: Any) {
            metrics[key] = value
        }
        
        fun getMetrics(): Map<String, Any> = metrics.toMap()
    }
}