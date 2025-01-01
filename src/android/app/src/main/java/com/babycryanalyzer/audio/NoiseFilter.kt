package com.babycryanalyzer.audio

import com.babycryanalyzer.utils.AudioUtils
import kotlin.math.*
import kotlinx.coroutines.*

/**
 * Advanced adaptive noise filtering implementation for the Baby Cry Analyzer application.
 * Provides real-time background noise reduction with statistical validation and dynamic threshold adjustment.
 *
 * @version 1.0
 */
class NoiseFilter {
    companion object {
        private const val NOISE_FLOOR_DB = -60.0f
        private const val ADAPTATION_RATE = 0.1f
        private const val FILTER_LENGTH = 256
        private const val SMOOTHING_FACTOR = 0.95f
        private const val MAX_ADAPTATION_RATE = 0.5f
        private const val MIN_ADAPTATION_RATE = 0.01f
        private const val OUTLIER_THRESHOLD = 2.5f
    }

    private var filterCoefficients = FloatArray(FILTER_LENGTH) { 0f }
    private var noiseProfile = FloatArray(FILTER_LENGTH) { NOISE_FLOOR_DB }
    private var currentNoiseLevel = 0f
    private val audioBufferPool = BufferPool(FILTER_LENGTH)
    private val noiseEstimator = KalmanFilter()
    private val signalValidator = StatisticalValidator()

    init {
        // Initialize filter coefficients with normalized weights
        val normalizationFactor = 1.0f / FILTER_LENGTH
        for (i in filterCoefficients.indices) {
            filterCoefficients[i] = normalizationFactor
        }
    }

    /**
     * Applies enhanced adaptive noise filtering to the input audio data.
     *
     * @param audioData Raw audio data to be filtered
     * @return Filtered audio data with reduced noise
     */
    @Synchronized
    fun filterNoise(audioData: ShortArray): ShortArray {
        // Input validation
        require(audioData.isNotEmpty()) { "Audio data cannot be empty" }

        // Get buffer from pool and normalize input
        val normalizedInput = audioBufferPool.acquire()
        AudioUtils.normalizeAudioData(audioData).copyInto(normalizedInput)

        // Detect and handle statistical outliers
        val validSamples = signalValidator.validateSamples(normalizedInput)
        
        // Apply adaptive filtering with momentum
        val filteredData = FloatArray(audioData.size)
        var momentum = 0f
        
        for (i in audioData.indices) {
            var filterOutput = 0f
            for (j in 0 until FILTER_LENGTH) {
                val index = (i - j).coerceAtLeast(0)
                filterOutput += filterCoefficients[j] * normalizedInput[index]
            }
            
            // Apply dynamic threshold adjustment
            val signalEnergy = AudioUtils.calculateRmsLevel(shortArrayOf(audioData[i]))
            val adaptiveThreshold = max(currentNoiseLevel * OUTLIER_THRESHOLD, NOISE_FLOOR_DB)
            
            // Update filter with momentum
            momentum = SMOOTHING_FACTOR * momentum + (1 - SMOOTHING_FACTOR) * filterOutput
            filteredData[i] = if (signalEnergy > adaptiveThreshold) {
                normalizedInput[i] - momentum
            } else {
                normalizedInput[i]
            }
        }

        // Convert back to short array with boundary checks
        val result = ShortArray(audioData.size)
        for (i in result.indices) {
            result[i] = (filteredData[i] * AudioUtils.MAX_AMPLITUDE).toInt()
                .coerceIn(AudioUtils.MIN_AMPLITUDE, AudioUtils.MAX_AMPLITUDE)
                .toShort()
        }

        // Release buffer back to pool
        audioBufferPool.release(normalizedInput)

        return result
    }

    /**
     * Updates the background noise profile with enhanced statistical analysis.
     *
     * @param audioData Current audio frame data
     * @param noiseLevel Estimated noise level
     */
    fun updateNoiseProfile(audioData: ShortArray, noiseLevel: Float) {
        // Calculate current noise characteristics
        val rmsLevel = AudioUtils.calculateRmsLevel(audioData)
        val estimatedNoise = noiseEstimator.estimate(rmsLevel)

        // Update noise profile with Kalman-filtered estimate
        val adaptationRate = calculateAdaptationRate(estimatedNoise)
        
        for (i in noiseProfile.indices) {
            noiseProfile[i] = (1 - adaptationRate) * noiseProfile[i] + adaptationRate * estimatedNoise
        }

        // Update filter coefficients with normalization
        var sum = 0f
        for (i in filterCoefficients.indices) {
            filterCoefficients[i] = filterCoefficients[i] * (1 - adaptationRate) +
                    adaptationRate * noiseProfile[i]
            sum += filterCoefficients[i]
        }

        // Normalize coefficients
        if (sum != 0f) {
            for (i in filterCoefficients.indices) {
                filterCoefficients[i] /= sum
            }
        }

        currentNoiseLevel = estimatedNoise
    }

    /**
     * Resets the noise filter state.
     */
    fun reset() {
        filterCoefficients.fill(1f / FILTER_LENGTH)
        noiseProfile.fill(NOISE_FLOOR_DB)
        currentNoiseLevel = 0f
        audioBufferPool.clear()
        noiseEstimator.reset()
        signalValidator.reset()
    }

    /**
     * Calculates adaptive rate based on signal statistics.
     */
    private fun calculateAdaptationRate(noiseLevel: Float): Float {
        val normalizedLevel = (noiseLevel - NOISE_FLOOR_DB) / abs(NOISE_FLOOR_DB)
        return (MIN_ADAPTATION_RATE + (MAX_ADAPTATION_RATE - MIN_ADAPTATION_RATE) * normalizedLevel)
            .coerceIn(MIN_ADAPTATION_RATE, MAX_ADAPTATION_RATE)
    }

    /**
     * Memory-efficient buffer pool for audio processing.
     */
    private class BufferPool(private val bufferSize: Int) {
        private val pool = mutableListOf<FloatArray>()
        
        fun acquire(): FloatArray = synchronized(pool) {
            if (pool.isEmpty()) {
                FloatArray(bufferSize)
            } else {
                pool.removeAt(pool.lastIndex)
            }
        }

        fun release(buffer: FloatArray) = synchronized(pool) {
            buffer.fill(0f)
            pool.add(buffer)
        }

        fun clear() = synchronized(pool) {
            pool.clear()
        }
    }

    /**
     * Kalman filter for noise level estimation.
     */
    private class KalmanFilter {
        private var estimate = NOISE_FLOOR_DB
        private var errorCovariance = 1f
        private val processNoise = 0.001f
        private val measurementNoise = 0.1f

        fun estimate(measurement: Float): Float {
            // Prediction
            errorCovariance += processNoise

            // Update
            val kalmanGain = errorCovariance / (errorCovariance + measurementNoise)
            estimate += kalmanGain * (measurement - estimate)
            errorCovariance *= (1 - kalmanGain)

            return estimate
        }

        fun reset() {
            estimate = NOISE_FLOOR_DB
            errorCovariance = 1f
        }
    }

    /**
     * Statistical validator for signal analysis.
     */
    private class StatisticalValidator {
        private var mean = 0f
        private var variance = 0f
        private var sampleCount = 0

        fun validateSamples(samples: FloatArray): FloatArray {
            // Update statistics
            val n = samples.size
            var newMean = 0f
            var newVariance = 0f

            for (sample in samples) {
                newMean += sample
            }
            newMean /= n

            for (sample in samples) {
                val diff = sample - newMean
                newVariance += diff * diff
            }
            newVariance /= (n - 1)

            // Update running statistics
            mean = if (sampleCount == 0) newMean else (mean * sampleCount + newMean * n) / (sampleCount + n)
            variance = newVariance
            sampleCount += n

            // Validate and clean samples
            return FloatArray(samples.size) { i ->
                if (abs(samples[i] - mean) > OUTLIER_THRESHOLD * sqrt(variance)) {
                    mean
                } else {
                    samples[i]
                }
            }
        }

        fun reset() {
            mean = 0f
            variance = 0f
            sampleCount = 0
        }
    }
}