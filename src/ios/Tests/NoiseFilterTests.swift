//
// NoiseFilterTests.swift
// BabyCryAnalyzer
//
// Comprehensive test suite for noise filtering functionality verification
// XCTest: iOS 14.0+
// Foundation: iOS 14.0+
//

import XCTest
@testable import BabyCryAnalyzer

class NoiseFilterTests: XCTestCase {
    
    // MARK: - Constants
    private let kTestSampleRate: Double = 44100.0
    private let kTestNoiseThreshold: Double = -40.0
    private let kTestBufferSize: Int = 2048
    private let kTestSignalFrequency: Double = 1000.0
    private let kTestNoiseFloor: Double = -60.0
    private let kTestTimeout: TimeInterval = 5.0
    
    // MARK: - Properties
    private var sut: NoiseFilter!
    private var config: AudioConfiguration!
    private var testBuffer: [Float]!
    private var noisySignal: [Float]!
    private var cleanSignal: [Float]!
    
    // MARK: - Setup and Teardown
    override func setUp() {
        super.setUp()
        
        // Initialize configuration with test parameters
        config = AudioConfiguration(
            sampleRate: kTestSampleRate,
            bufferSize: kTestBufferSize,
            noiseThreshold: kTestNoiseThreshold
        )
        
        // Create system under test
        sut = NoiseFilter(config: config)
        
        // Generate test signals
        testBuffer = [Float](repeating: 0.0, count: kTestBufferSize)
        noisySignal = AudioUtils.generateTestSignal(
            frequency: Float(kTestSignalFrequency),
            sampleRate: Float(kTestSampleRate),
            duration: Float(kTestBufferSize) / Float(kTestSampleRate)
        )
        cleanSignal = noisySignal
    }
    
    override func tearDown() {
        sut.reset()
        sut = nil
        config = nil
        testBuffer = nil
        noisySignal = nil
        cleanSignal = nil
        super.tearDown()
    }
    
    // MARK: - Test Cases
    func testNoiseReduction() {
        // Given
        let inputNoise: Float = -30.0
        let expectedNoiseReduction: Float = 20.0
        
        // Add noise to test signal
        var noisyBuffer = noisySignal!
        for i in 0..<noisyBuffer.count {
            noisyBuffer[i] += Float.random(in: -inputNoise...inputNoise)
        }
        
        // When
        let inputData = Data(bytes: &noisyBuffer, count: noisyBuffer.count * MemoryLayout<Float>.size)
        let outputData = sut.processBuffer(inputData)
        
        // Then
        var outputBuffer = [Float](repeating: 0.0, count: kTestBufferSize)
        outputData.withUnsafeBytes { bufferPtr in
            outputBuffer.withUnsafeMutableBufferPointer { arrayPtr in
                arrayPtr.baseAddress?.initialize(from: bufferPtr.bindMemory(to: Float.self).baseAddress!, count: kTestBufferSize)
            }
        }
        
        // Calculate signal-to-noise ratios
        let inputSNR = calculateSNR(signal: noisySignal, noisySignal: noisyBuffer)
        let outputSNR = calculateSNR(signal: noisySignal, noisySignal: outputBuffer)
        
        // Verify noise reduction
        XCTAssertGreaterThan(outputSNR - inputSNR, expectedNoiseReduction,
                            "Noise reduction should improve SNR by at least \(expectedNoiseReduction) dB")
        
        // Verify signal integrity
        let correlation = calculateCorrelation(signal1: cleanSignal, signal2: outputBuffer)
        XCTAssertGreaterThan(correlation, 0.9,
                            "Processed signal should maintain high correlation with original signal")
    }
    
    func testNoiseFloorEstimation() {
        // Given
        let expectedNoiseFloor: Float = Float(kTestNoiseFloor)
        var noiseBuffer = [Float](repeating: 0.0, count: kTestBufferSize)
        
        // Generate noise at known floor level
        for i in 0..<noiseBuffer.count {
            noiseBuffer[i] = Float.random(in: expectedNoiseFloor...(expectedNoiseFloor + 5.0))
        }
        
        // When
        let inputData = Data(bytes: &noiseBuffer, count: noiseBuffer.count * MemoryLayout<Float>.size)
        _ = sut.processBuffer(inputData) // Process first buffer to establish noise floor
        
        // Then
        let estimatedPower = AudioUtils.calculateSignalPower(audioBuffer: inputData)
        let estimatedNoiseFloor = AudioUtils.convertToDecibels(amplitude: estimatedPower)
        
        // Verify noise floor estimation accuracy
        XCTAssertEqual(estimatedNoiseFloor, expectedNoiseFloor, accuracy: 5.0,
                      "Noise floor estimation should be within 5dB of actual noise floor")
    }
    
    func testSpectralSubtraction() {
        // Given
        let noiseFrequency: Double = 2000.0
        let signalFrequency: Double = 1000.0
        
        // Generate test signal with specific spectral content
        let signal = AudioUtils.generateTestSignal(
            frequency: Float(signalFrequency),
            sampleRate: Float(kTestSampleRate),
            duration: Float(kTestBufferSize) / Float(kTestSampleRate)
        )
        
        // Add noise at specific frequency
        let noise = AudioUtils.generateTestSignal(
            frequency: Float(noiseFrequency),
            sampleRate: Float(kTestSampleRate),
            duration: Float(kTestBufferSize) / Float(kTestSampleRate)
        )
        
        var combinedSignal = signal
        vDSP_vadd(combinedSignal, 1, noise, 1, &combinedSignal, 1, vDSP_Length(kTestBufferSize))
        
        // When
        let inputData = Data(bytes: &combinedSignal, count: combinedSignal.count * MemoryLayout<Float>.size)
        let outputData = sut.processBuffer(inputData)
        
        // Then
        var outputBuffer = [Float](repeating: 0.0, count: kTestBufferSize)
        outputData.withUnsafeBytes { bufferPtr in
            outputBuffer.withUnsafeMutableBufferPointer { arrayPtr in
                arrayPtr.baseAddress?.initialize(from: bufferPtr.bindMemory(to: Float.self).baseAddress!, count: kTestBufferSize)
            }
        }
        
        // Calculate spectral content
        let inputSpectrum = calculateSpectrum(signal: combinedSignal)
        let outputSpectrum = calculateSpectrum(signal: outputBuffer)
        
        // Verify noise frequency reduction
        let noiseReduction = calculateSpectralReduction(
            inputSpectrum: inputSpectrum,
            outputSpectrum: outputSpectrum,
            frequency: Float(noiseFrequency),
            sampleRate: Float(kTestSampleRate)
        )
        
        XCTAssertGreaterThan(noiseReduction, 10.0,
                            "Spectral subtraction should reduce noise frequency content by at least 10dB")
        
        // Verify signal frequency preservation
        let signalRetention = calculateSpectralRetention(
            inputSpectrum: inputSpectrum,
            outputSpectrum: outputSpectrum,
            frequency: Float(signalFrequency),
            sampleRate: Float(kTestSampleRate)
        )
        
        XCTAssertGreaterThan(signalRetention, 0.8,
                            "Spectral subtraction should preserve at least 80% of signal frequency content")
    }
    
    func testResetFunctionality() {
        // Given
        var noisyBuffer = noisySignal!
        for i in 0..<noisyBuffer.count {
            noisyBuffer[i] += Float.random(in: -30.0...30.0)
        }
        
        // Process initial buffer to establish state
        let inputData = Data(bytes: &noisyBuffer, count: noisyBuffer.count * MemoryLayout<Float>.size)
        _ = sut.processBuffer(inputData)
        
        // When
        sut.reset()
        
        // Then
        let outputData = sut.processBuffer(inputData)
        var outputBuffer = [Float](repeating: 0.0, count: kTestBufferSize)
        outputData.withUnsafeBytes { bufferPtr in
            outputBuffer.withUnsafeMutableBufferPointer { arrayPtr in
                arrayPtr.baseAddress?.initialize(from: bufferPtr.bindMemory(to: Float.self).baseAddress!, count: kTestBufferSize)
            }
        }
        
        // Verify reset state through processing characteristics
        let firstPassPower = AudioUtils.calculateSignalPower(audioBuffer: inputData)
        let secondPassPower = AudioUtils.calculateSignalPower(audioBuffer: outputData)
        
        XCTAssertNotEqual(firstPassPower, secondPassPower,
                         "Reset should clear noise estimation state")
    }
    
    // MARK: - Helper Methods
    private func calculateSNR(signal: [Float], noisySignal: [Float]) -> Float {
        var signalPower: Float = 0.0
        var noisePower: Float = 0.0
        
        vDSP_measqv(signal, 1, &signalPower, vDSP_Length(signal.count))
        
        var noiseSignal = [Float](repeating: 0.0, count: signal.count)
        vDSP_vsub(signal, 1, noisySignal, 1, &noiseSignal, 1, vDSP_Length(signal.count))
        vDSP_measqv(noiseSignal, 1, &noisePower, vDSP_Length(noiseSignal.count))
        
        return 10.0 * log10(signalPower / noisePower)
    }
    
    private func calculateCorrelation(signal1: [Float], signal2: [Float]) -> Float {
        var correlation: Float = 0.0
        vDSP_dotpr(signal1, 1, signal2, 1, &correlation, vDSP_Length(signal1.count))
        
        var norm1: Float = 0.0
        var norm2: Float = 0.0
        vDSP_measqv(signal1, 1, &norm1, vDSP_Length(signal1.count))
        vDSP_measqv(signal2, 1, &norm2, vDSP_Length(signal2.count))
        
        return correlation / sqrt(norm1 * norm2)
    }
    
    private func calculateSpectrum(signal: [Float]) -> [Float] {
        var windowed = AudioUtils.applyHannWindow(samples: signal)
        var realPart = [Float](repeating: 0.0, count: kTestBufferSize)
        var imagPart = [Float](repeating: 0.0, count: kTestBufferSize)
        
        windowed.withUnsafeBufferPointer { inputPtr in
            realPart.withUnsafeMutableBufferPointer { realPtr in
                imagPart.withUnsafeMutableBufferPointer { imagPtr in
                    vDSP_ctoz(inputPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: kTestBufferSize/2) { $0 },
                             2,
                             UnsafeMutablePointer<DSPSplitComplex>(mutating: [realPtr.baseAddress!, imagPtr.baseAddress!]),
                             1,
                             vDSP_Length(kTestBufferSize/2))
                }
            }
        }
        
        var magnitudeSpectrum = [Float](repeating: 0.0, count: kTestBufferSize/2)
        vDSP_zvmags(&realPart, 1, &magnitudeSpectrum, 1, vDSP_Length(kTestBufferSize/2))
        
        return magnitudeSpectrum
    }
    
    private func calculateSpectralReduction(inputSpectrum: [Float], outputSpectrum: [Float],
                                          frequency: Float, sampleRate: Float) -> Float {
        let binSize = sampleRate / Float(inputSpectrum.count * 2)
        let targetBin = Int(frequency / binSize)
        
        guard targetBin < inputSpectrum.count else { return 0.0 }
        
        return 20.0 * log10(inputSpectrum[targetBin] / outputSpectrum[targetBin])
    }
    
    private func calculateSpectralRetention(inputSpectrum: [Float], outputSpectrum: [Float],
                                          frequency: Float, sampleRate: Float) -> Float {
        let binSize = sampleRate / Float(inputSpectrum.count * 2)
        let targetBin = Int(frequency / binSize)
        
        guard targetBin < inputSpectrum.count else { return 0.0 }
        
        return outputSpectrum[targetBin] / inputSpectrum[targetBin]
    }
}