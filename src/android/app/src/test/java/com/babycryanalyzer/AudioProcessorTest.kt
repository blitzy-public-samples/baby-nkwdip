package com.babycryanalyzer

import com.babycryanalyzer.audio.AudioProcessor
import com.babycryanalyzer.audio.NoiseFilter
import com.babycryanalyzer.utils.AudioUtils
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.*
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.mockito.kotlin.*
import kotlin.math.PI
import kotlin.math.sin

@ExperimentalCoroutinesApi
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AudioProcessorTest {
    // Test constants
    private companion object {
        const val TEST_FRAME_SIZE = 1024
        const val TEST_SAMPLE_RATE = 44100
        const val CONFIDENCE_THRESHOLD = 0.85f
        const val MAX_PROCESSING_LATENCY_MS = 100L
        const val MIN_SNR_DB = 15.0
        const val CLASSIFICATION_ACCURACY_THRESHOLD = 0.90
        const val TEST_DURATION_MS = 1000
    }

    private lateinit var audioProcessor: AudioProcessor
    private lateinit var noiseFilter: NoiseFilter
    private lateinit var testDispatcher: TestCoroutineDispatcher
    private lateinit var context: android.content.Context

    @BeforeEach
    fun setUp() {
        testDispatcher = TestCoroutineDispatcher()
        noiseFilter = mock()
        context = mock()

        // Configure NoiseFilter mock with realistic behavior
        whenever(noiseFilter.filterNoise(any())).thenAnswer { invocation ->
            val input = invocation.getArgument<ShortArray>(0)
            input.clone() // Return filtered copy
        }

        // Initialize AudioProcessor with test configuration
        audioProcessor = AudioProcessor(context)
    }

    @AfterEach
    fun tearDown() {
        testDispatcher.cleanupTestCoroutines()
        audioProcessor.release()
    }

    @Test
    fun `test real-time processing performance`() = runTest {
        // Generate test audio frames
        val testFrames = generateTestFrames(TEST_DURATION_MS)
        val latencies = mutableListOf<Long>()

        audioProcessor.startProcessing()

        testFrames.forEach { frame ->
            val startTime = System.nanoTime()
            val result = audioProcessor.processAudioFrame(frame)
            val processingTime = (System.nanoTime() - startTime) / 1_000_000 // Convert to ms

            latencies.add(processingTime)
            
            // Verify real-time processing capability
            assertThat(processingTime).isLessThan(MAX_PROCESSING_LATENCY_MS)
            assertThat(result).isNotNull
        }

        audioProcessor.stopProcessing()

        // Validate average latency
        val avgLatency = latencies.average()
        assertThat(avgLatency).isLessThan(MAX_PROCESSING_LATENCY_MS * 0.8)
    }

    @Test
    fun `test classification accuracy with known patterns`() = runTest {
        val testPatterns = generateKnownPatterns()
        var correctClassifications = 0

        audioProcessor.startProcessing()

        testPatterns.forEach { (pattern, expectedCry) ->
            val result = audioProcessor.processAudioFrame(pattern)
            
            if (result.isCryDetected == expectedCry && result.confidence >= CONFIDENCE_THRESHOLD) {
                correctClassifications++
            }

            // Verify confidence score validity
            assertThat(result.confidence).isBetween(0f, 1f)
            
            // Verify feature extraction
            assertThat(result.features).isNotEmpty
                .containsKeys("fundamentalFrequency", "spectralCentroid", "rmsLevel")
        }

        audioProcessor.stopProcessing()

        // Verify classification accuracy meets threshold
        val accuracy = correctClassifications.toFloat() / testPatterns.size
        assertThat(accuracy).isGreaterThanOrEqualTo(CLASSIFICATION_ACCURACY_THRESHOLD)
    }

    @ParameterizedTest
    @ValueSource(floats = [0.1f, 0.5f, 1.0f])
    fun `test noise filtering integration at different levels`(noiseLevel: Float) = runTest {
        // Generate test signal with controlled noise
        val testSignal = generateSyntheticCryPattern(noiseLevel)
        
        whenever(noiseFilter.getSignalToNoiseRatio()).thenReturn(MIN_SNR_DB + (1 - noiseLevel) * 20)

        audioProcessor.startProcessing()
        val result = audioProcessor.processAudioFrame(testSignal)
        audioProcessor.stopProcessing()

        // Verify noise filtering effectiveness
        verify(noiseFilter).filterNoise(any())
        verify(noiseFilter).updateNoiseProfile(any(), any())
        
        // Higher noise levels should result in lower confidence
        assertThat(result.confidence).isLessThanOrEqualTo(1 - noiseLevel)
    }

    @Test
    fun `test processing state management`() = runTest {
        // Test start processing
        audioProcessor.startProcessing()
        val frame = generateTestFrame()
        val result1 = audioProcessor.processAudioFrame(frame)
        assertThat(result1).isNotNull

        // Test stop processing
        audioProcessor.stopProcessing()
        val result2 = audioProcessor.processAudioFrame(frame)
        assertThat(result2.confidence).isLessThan(result1.confidence)
    }

    private fun generateTestFrames(durationMs: Int): List<ShortArray> {
        val framesCount = (durationMs * TEST_SAMPLE_RATE) / (1000 * TEST_FRAME_SIZE)
        return List(framesCount) { generateTestFrame() }
    }

    private fun generateTestFrame(): ShortArray {
        return ShortArray(TEST_FRAME_SIZE) { i ->
            // Generate simple sine wave
            (sin(2.0 * PI * 440.0 * i / TEST_SAMPLE_RATE) * AudioUtils.MAX_AMPLITUDE).toInt().toShort()
        }
    }

    private fun generateKnownPatterns(): List<Pair<ShortArray, Boolean>> {
        return listOf(
            generateSyntheticCryPattern(0.2f) to true,
            generateTestFrame() to false,
            generateSyntheticCryPattern(0.3f) to true,
            generateWhiteNoise() to false
        )
    }

    private fun generateSyntheticCryPattern(noiseLevel: Float): ShortArray {
        return ShortArray(TEST_FRAME_SIZE) { i ->
            // Combine cry frequency components with noise
            val signal = sin(2.0 * PI * 400.0 * i / TEST_SAMPLE_RATE) + // Fundamental
                    0.5 * sin(2.0 * PI * 800.0 * i / TEST_SAMPLE_RATE) + // First harmonic
                    0.25 * sin(2.0 * PI * 1200.0 * i / TEST_SAMPLE_RATE) // Second harmonic
            
            val noise = (Math.random() * 2 - 1) * noiseLevel
            ((signal * (1 - noiseLevel) + noise) * AudioUtils.MAX_AMPLITUDE).toInt().toShort()
        }
    }

    private fun generateWhiteNoise(): ShortArray {
        return ShortArray(TEST_FRAME_SIZE) { 
            (Math.random() * 2 - 1 * AudioUtils.MAX_AMPLITUDE).toInt().toShort()
        }
    }
}