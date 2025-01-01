package com.babycryanalyzer.utils

import android.media.AudioFormat
import android.media.AudioRecord
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Utility object providing optimized audio processing functions and configurations
 * for real-time audio analysis in the Baby Cry Analyzer application.
 *
 * @version 1.0
 */
object AudioUtils {
    // Audio configuration constants
    const val SAMPLE_RATE = 44100
    const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    
    // Frame configuration for analysis
    const val FRAME_SIZE_MS = 30
    const val FRAME_OVERLAP_MS = 10
    
    // Audio processing constants
    const val MIN_AMPLITUDE = -32768
    const val MAX_AMPLITUDE = 32767
    const val BUFFER_SIZE_SAFETY_FACTOR = 1.5f
    const val DC_OFFSET_WINDOW_SIZE = 1024

    /**
     * Calculates optimal buffer size for audio recording with safety margin.
     *
     * @param sampleRate The audio sampling rate in Hz
     * @param channelConfig The channel configuration (mono/stereo)
     * @param audioFormat The audio encoding format
     * @return Optimized buffer size in bytes with safety margin
     * @throws IllegalStateException if minimum buffer size cannot be determined
     */
    @JvmStatic
    fun calculateBufferSize(
        sampleRate: Int = SAMPLE_RATE,
        channelConfig: Int = CHANNEL_CONFIG,
        audioFormat: Int = AUDIO_FORMAT
    ): Int {
        val minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            channelConfig,
            audioFormat
        )

        if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
            throw IllegalStateException("Failed to calculate minimum buffer size")
        }

        // Apply safety factor and round to nearest power of 2
        val safeBufferSize = (minBufferSize * BUFFER_SIZE_SAFETY_FACTOR).toInt()
        var powerOf2BufferSize = 1
        while (powerOf2BufferSize < safeBufferSize) {
            powerOf2BufferSize = powerOf2BufferSize shl 1
        }

        return powerOf2BufferSize
    }

    /**
     * Calculates RMS level of audio data for volume analysis.
     *
     * @param audioData Raw audio data array
     * @return Normalized RMS level in range [0.0, 1.0]
     */
    @JvmStatic
    fun calculateRmsLevel(audioData: ShortArray): Float {
        var sum = 0.0
        val samples = audioData.size

        // Process in chunks to avoid potential overflow
        for (i in audioData.indices) {
            sum += (audioData[i].toDouble() / MAX_AMPLITUDE).pow(2)
        }

        val rms = sqrt(sum / samples)
        return rms.toFloat().coerceIn(0f, 1f)
    }

    /**
     * Normalizes audio data with DC offset removal and amplitude scaling.
     *
     * @param audioData Raw audio data array
     * @return Normalized audio data in range [-1.0, 1.0]
     */
    @JvmStatic
    fun normalizeAudioData(audioData: ShortArray): FloatArray {
        val normalizedData = FloatArray(audioData.size)
        var dcOffset = 0.0

        // Calculate DC offset using sliding window
        for (i in 0 until minOf(DC_OFFSET_WINDOW_SIZE, audioData.size)) {
            dcOffset += audioData[i].toDouble()
        }
        dcOffset /= minOf(DC_OFFSET_WINDOW_SIZE, audioData.size)

        // Normalize and apply Hamming window
        for (i in audioData.indices) {
            // Remove DC offset and normalize to [-1.0, 1.0]
            val normalizedSample = (audioData[i] - dcOffset) / MAX_AMPLITUDE
            
            // Apply Hamming window for edge smoothing
            val windowMultiplier = 0.54 - 0.46 * kotlin.math.cos(2.0 * Math.PI * i / (audioData.size - 1))
            normalizedData[i] = (normalizedSample * windowMultiplier).toFloat()
        }

        return normalizedData
    }

    /**
     * Calculates frame size in samples ensuring power of 2 for FFT compatibility.
     *
     * @param durationMs Desired frame duration in milliseconds
     * @return Frame size in samples (power of 2)
     * @throws IllegalArgumentException if calculated frame size exceeds memory constraints
     */
    @JvmStatic
    fun calculateFrameSize(durationMs: Int): Int {
        val samplesPerFrame = (SAMPLE_RATE * durationMs / 1000)
        var frameSize = 1

        while (frameSize < samplesPerFrame) {
            frameSize = frameSize shl 1
            if (frameSize > SAMPLE_RATE) {
                throw IllegalArgumentException("Frame size exceeds maximum allowed size")
            }
        }

        return frameSize
    }
}