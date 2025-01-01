//
// NoiseFilter.swift
// BabyCryAnalyzer
//
// Implements adaptive noise filtering with enhanced spectral subtraction
// Foundation: iOS 14.0+
// Accelerate: iOS 14.0+
// AVFoundation: iOS 14.0+
//

import Foundation
import Accelerate
import AVFoundation

// MARK: - Global Constants
private let kDefaultWindowSize: Int = 2048
private let kMinimumNoiseFloor: Float = -60.0
private let kSpectralSubtractionAlpha: Float = 2.0
private let kSmoothingFactor: Float = 0.8
private let kMaxNoiseReduction: Float = 24.0

// MARK: - NoiseFilter Class
@objc public class NoiseFilter: NSObject {
    
    // MARK: - Private Properties
    private let configuration: AudioConfiguration
    private var noiseSpectrum: [Float]
    private var noiseFloor: Float
    private var fftSetup: vDSP_DFT_Setup?
    private var previousFrame: [Float]
    private var smoothingFactor: Float
    private var hanningWindow: [Float]
    private var overlapBuffer: [Float]
    
    // MARK: - Initialization
    public init(config: AudioConfiguration) {
        self.configuration = config
        self.noiseSpectrum = [Float](repeating: 0.0, count: kDefaultWindowSize / 2)
        self.noiseFloor = kMinimumNoiseFloor
        self.previousFrame = [Float](repeating: 0.0, count: kDefaultWindowSize)
        self.smoothingFactor = kSmoothingFactor
        self.overlapBuffer = [Float](repeating: 0.0, count: kDefaultWindowSize)
        
        // Create Hanning window
        self.hanningWindow = [Float](repeating: 0.0, count: kDefaultWindowSize)
        vDSP_hann_window(&self.hanningWindow, vDSP_Length(kDefaultWindowSize), Int32(vDSP_HANN_NORM))
        
        super.init()
        
        // Initialize FFT setup
        self.fftSetup = vDSP_DFT_zop_CreateSetup(
            nil,
            vDSP_Length(kDefaultWindowSize),
            vDSP_DFT_FORWARD
        )
    }
    
    deinit {
        if let setup = fftSetup {
            vDSP_DFT_DestroySetup(setup)
        }
    }
    
    // MARK: - Public Methods
    public func processBuffer(_ inputBuffer: Data) -> Data {
        guard inputBuffer.count >= kDefaultWindowSize * MemoryLayout<Float>.size else {
            return inputBuffer
        }
        
        // Convert input data to float array
        var inputArray = [Float](repeating: 0.0, count: kDefaultWindowSize)
        inputBuffer.withUnsafeBytes { bufferPtr in
            let floatPtr = bufferPtr.bindMemory(to: Float.self)
            inputArray.withUnsafeMutableBufferPointer { arrayPtr in
                arrayPtr.baseAddress?.initialize(from: floatPtr.baseAddress!, count: kDefaultWindowSize)
            }
        }
        
        // Apply window function
        var windowedInput = [Float](repeating: 0.0, count: kDefaultWindowSize)
        vDSP_vmul(inputArray, 1, hanningWindow, 1, &windowedInput, 1, vDSP_Length(kDefaultWindowSize))
        
        // Perform FFT
        var realPart = [Float](repeating: 0.0, count: kDefaultWindowSize)
        var imagPart = [Float](repeating: 0.0, count: kDefaultWindowSize)
        
        windowedInput.withUnsafeBufferPointer { inputPtr in
            realPart.withUnsafeMutableBufferPointer { realPtr in
                imagPart.withUnsafeMutableBufferPointer { imagPtr in
                    vDSP_ctoz(inputPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: kDefaultWindowSize/2) { $0 },
                             2,
                             UnsafeMutablePointer<DSPSplitComplex>(mutating: [realPtr.baseAddress!, imagPtr.baseAddress!]),
                             1,
                             vDSP_Length(kDefaultWindowSize/2))
                }
            }
        }
        
        // Calculate magnitude spectrum
        var magnitudeSpectrum = [Float](repeating: 0.0, count: kDefaultWindowSize/2)
        vDSP_zvmags(&realPart, 1, &magnitudeSpectrum, 1, vDSP_Length(kDefaultWindowSize/2))
        
        // Estimate noise spectrum
        let noiseEstimate = estimateNoiseSpectrum(magnitudeSpectrum)
        
        // Apply spectral subtraction
        let cleanSpectrum = applySpectralSubtraction(inputSpectrum: magnitudeSpectrum, noiseSpectrum: noiseEstimate)
        
        // Reconstruct signal
        var outputArray = [Float](repeating: 0.0, count: kDefaultWindowSize)
        vDSP_ztoc(UnsafePointer<DSPSplitComplex>(mutating: [cleanSpectrum, imagPart]),
                  2,
                  outputArray.withUnsafeMutableBufferPointer { $0 }.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: kDefaultWindowSize/2) { $0 },
                  1,
                  vDSP_Length(kDefaultWindowSize/2))
        
        // Apply overlap-add
        vDSP_vadd(outputArray, 1, overlapBuffer, 1, &outputArray, 1, vDSP_Length(kDefaultWindowSize))
        
        // Update overlap buffer
        overlapBuffer = Array(outputArray.suffix(kDefaultWindowSize/2))
        
        // Convert back to Data
        return Data(bytes: outputArray, count: outputArray.count * MemoryLayout<Float>.size)
    }
    
    public func reset() {
        noiseSpectrum = [Float](repeating: 0.0, count: kDefaultWindowSize / 2)
        noiseFloor = kMinimumNoiseFloor
        previousFrame = [Float](repeating: 0.0, count: kDefaultWindowSize)
        overlapBuffer = [Float](repeating: 0.0, count: kDefaultWindowSize)
    }
    
    // MARK: - Private Methods
    private func estimateNoiseSpectrum(_ magnitudeSpectrum: [Float]) -> [Float] {
        var estimatedNoise = [Float](repeating: 0.0, count: magnitudeSpectrum.count)
        
        // Update noise estimate using temporal smoothing
        vDSP_vma(magnitudeSpectrum, 1,
                 [1.0 - smoothingFactor], 0,
                 noiseSpectrum, 1,
                 &estimatedNoise, 1,
                 vDSP_Length(magnitudeSpectrum.count))
        
        // Apply noise floor
        var floor = [Float](repeating: noiseFloor, count: magnitudeSpectrum.count)
        vDSP_vmax(estimatedNoise, 1, floor, 1, &estimatedNoise, 1, vDSP_Length(magnitudeSpectrum.count))
        
        // Update internal noise spectrum
        noiseSpectrum = estimatedNoise
        
        return estimatedNoise
    }
    
    private func applySpectralSubtraction(inputSpectrum: [Float], noiseSpectrum: [Float]) -> [Float] {
        var cleanSpectrum = [Float](repeating: 0.0, count: inputSpectrum.count)
        
        // Apply oversubtraction factor
        var scaledNoise = [Float](repeating: 0.0, count: noiseSpectrum.count)
        vDSP_vsmul(noiseSpectrum, 1, [kSpectralSubtractionAlpha], &scaledNoise, 1, vDSP_Length(noiseSpectrum.count))
        
        // Perform spectral subtraction
        vDSP_vsub(scaledNoise, 1, inputSpectrum, 1, &cleanSpectrum, 1, vDSP_Length(inputSpectrum.count))
        
        // Apply spectral floor
        var floor = [Float](repeating: configuration.noiseThreshold, count: inputSpectrum.count)
        vDSP_vmax(cleanSpectrum, 1, floor, 1, &cleanSpectrum, 1, vDSP_Length(inputSpectrum.count))
        
        // Apply smoothing to prevent musical noise
        vDSP_vma(cleanSpectrum, 1,
                 [smoothingFactor], 0,
                 previousFrame, 1,
                 &cleanSpectrum, 1,
                 vDSP_Length(inputSpectrum.count))
        
        // Update previous frame
        previousFrame = cleanSpectrum
        
        return cleanSpectrum
    }
}