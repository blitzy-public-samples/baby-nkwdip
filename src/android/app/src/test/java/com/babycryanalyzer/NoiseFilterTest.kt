package com.babycryanalyzer

import com.babycryanalyzer.audio.NoiseFilter
import com.babycryanalyzer.utils.AudioUtils
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import kotlin.math.*

/**
 * Comprehensive test suite for NoiseFilter class validating noise filtering algorithms,
 * background noise estimation, and adaptive filtering capabilities.
 *
 * @version 1.0
 */
class NoiseFilterTest {
    companion object {
        private const val NOISE_THRESHOLD_DB = -60.0
        private const val SIGNAL_TO_NOISE_RATIO_MIN = 20.0
        private const val TEST_SAMPLE_DURATION_MS = 1000
        private const val TEST_SAMPLE_SIZE = AudioUtils.SAMPLE_RATE * TEST_SAMPLE_DURATION_MS / 1000
    }

    private lateinit var noiseFilter: NoiseFilter
    private lateinit var testAudioData: ShortArray
    private var baselineNoiseLevel: Double = 0.0
    private val performanceMetrics = mutableMapOf<String, Double>()

    @Before
    fun setUp() {
        noiseFilter = NoiseFilter()
        noiseFilter.reset()
        
        // Generate test audio data with known characteristics
        testAudioData = ShortArray(TEST_SAMPLE_SIZE) { i ->
            // Create a synthetic signal with controlled noise
            val signal = (AudioUtils.MAX_AMPLITUDE * 0.5 * sin(2.0 * PI * i / 100.0)).toInt()
            val noise = (AudioUtils.MAX_AMPLITUDE * 0.1 * Random.nextDouble()).toInt()
            (signal + noise).coerceIn(AudioUtils.MIN_AMPLITUDE, AudioUtils.MAX_AMPLITUDE).toShort()
        }
        
        // Calculate baseline noise level
        baselineNoiseLevel = calculateNoiseLevel(testAudioData)
    }

    @Test
    fun testNoiseFiltering() {
        // Apply noise filtering
        val startTime = System.nanoTime()
        val filteredData = noiseFilter.filterNoise(testAudioData)
        val processingTime = (System.nanoTime() - startTime) / 1_000_000.0 // Convert to ms
        
        // Calculate signal-to-noise ratio improvement
        val originalSnr = calculateSnr(testAudioData)
        val filteredSnr = calculateSnr(filteredData)
        val snrImprovement = filteredSnr - originalSnr
        
        // Store performance metrics
        performanceMetrics["processingTimeMs"] = processingTime
        performanceMetrics["snrImprovement"] = snrImprovement
        
        // Validate filtering effectiveness
        assertTrue("SNR improvement should meet minimum requirement",
            snrImprovement >= SIGNAL_TO_NOISE_RATIO_MIN)
        
        assertTrue("Processing time should be within real-time constraints",
            processingTime < TEST_SAMPLE_DURATION_MS)
        
        // Verify signal integrity
        val signalCorrelation = calculateCorrelation(testAudioData, filteredData)
        assertTrue("Signal integrity should be maintained",
            signalCorrelation > 0.9)
    }

    @Test
    fun testNoiseEstimation() {
        // Generate test data with known noise levels
        val noiseLevels = listOf(0.1f, 0.2f, 0.3f).map { it * AudioUtils.MAX_AMPLITUDE }
        val estimationErrors = mutableListOf<Double>()
        
        for (noiseLevel in noiseLevels) {
            // Create test data with specific noise level
            val testData = ShortArray(TEST_SAMPLE_SIZE) { i ->
                val signal = (AudioUtils.MAX_AMPLITUDE * 0.5 * sin(2.0 * PI * i / 100.0)).toInt()
                val noise = (noiseLevel * Random.nextDouble()).toInt()
                (signal + noise).coerceIn(AudioUtils.MIN_AMPLITUDE, AudioUtils.MAX_AMPLITUDE).toShort()
            }
            
            // Update noise profile and measure estimation accuracy
            noiseFilter.updateNoiseProfile(testData, noiseLevel)
            val estimatedLevel = calculateNoiseLevel(noiseFilter.filterNoise(testData))
            val error = abs(estimatedLevel - noiseLevel) / noiseLevel
            estimationErrors.add(error)
        }
        
        // Calculate statistical measures
        val meanError = estimationErrors.average()
        val errorStdDev = calculateStandardDeviation(estimationErrors)
        
        // Validate estimation accuracy
        assertTrue("Mean estimation error should be below 10%",
            meanError < 0.1)
        
        assertTrue("Estimation error variance should be stable",
            errorStdDev < 0.05)
    }

    @Test
    fun testAdaptiveFiltering() {
        // Test adaptation to changing noise conditions
        val noiseLevels = listOf(0.1f, 0.3f, 0.15f).map { it * AudioUtils.MAX_AMPLITUDE }
        var previousFilteredRms = 0.0
        
        for (noiseLevel in noiseLevels) {
            // Generate test data with changing noise profile
            val testData = ShortArray(TEST_SAMPLE_SIZE) { i ->
                val signal = (AudioUtils.MAX_AMPLITUDE * 0.5 * sin(2.0 * PI * i / 100.0)).toInt()
                val noise = (noiseLevel * Random.nextDouble()).toInt()
                (signal + noise).coerceIn(AudioUtils.MIN_AMPLITUDE, AudioUtils.MAX_AMPLITUDE).toShort()
            }
            
            // Apply filtering and measure adaptation
            val filteredData = noiseFilter.filterNoise(testData)
            val currentFilteredRms = AudioUtils.calculateRmsLevel(filteredData).toDouble()
            
            if (previousFilteredRms > 0) {
                val adaptationRate = abs(currentFilteredRms - previousFilteredRms) / previousFilteredRms
                assertTrue("Adaptation rate should be within bounds",
                    adaptationRate < 0.5)
            }
            
            previousFilteredRms = currentFilteredRms
            noiseFilter.updateNoiseProfile(testData, noiseLevel)
        }
    }

    @Test
    fun testFilterReset() {
        // Apply initial filtering
        val initialFiltered = noiseFilter.filterNoise(testAudioData)
        val initialRms = AudioUtils.calculateRmsLevel(initialFiltered)
        
        // Update noise profile
        noiseFilter.updateNoiseProfile(testAudioData, 0.2f * AudioUtils.MAX_AMPLITUDE)
        
        // Reset filter
        noiseFilter.reset()
        
        // Apply filtering after reset
        val resetFiltered = noiseFilter.filterNoise(testAudioData)
        val resetRms = AudioUtils.calculateRmsLevel(resetFiltered)
        
        // Verify reset effectiveness
        assertEquals("Filter should return to initial state after reset",
            initialRms, resetRms, 0.01)
    }

    private fun calculateNoiseLevel(audioData: ShortArray): Double {
        val rms = AudioUtils.calculateRmsLevel(audioData)
        return 20 * log10(rms.toDouble())
    }

    private fun calculateSnr(audioData: ShortArray): Double {
        val signalPower = audioData.map { it.toDouble().pow(2) }.average()
        val noisePower = audioData.map { 
            (it - (AudioUtils.MAX_AMPLITUDE * 0.5 * sin(2.0 * PI * audioData.indexOf(it) / 100.0)))
                .toDouble().pow(2) 
        }.average()
        return 10 * log10(signalPower / noisePower)
    }

    private fun calculateCorrelation(original: ShortArray, filtered: ShortArray): Double {
        require(original.size == filtered.size) { "Arrays must have same size" }
        
        val originalMean = original.average()
        val filteredMean = filtered.average()
        
        var numerator = 0.0
        var originalDenominator = 0.0
        var filteredDenominator = 0.0
        
        for (i in original.indices) {
            val originalDiff = original[i] - originalMean
            val filteredDiff = filtered[i] - filteredMean
            numerator += originalDiff * filteredDiff
            originalDenominator += originalDiff * originalDiff
            filteredDenominator += filteredDiff * filteredDiff
        }
        
        return numerator / sqrt(originalDenominator * filteredDenominator)
    }

    private fun calculateStandardDeviation(values: List<Double>): Double {
        val mean = values.average()
        val variance = values.map { (it - mean).pow(2) }.average()
        return sqrt(variance)
    }
}