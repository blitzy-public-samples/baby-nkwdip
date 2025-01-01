//
// AudioUtils.swift
// BabyCryAnalyzer
//
// High-performance utility class providing optimized audio processing functions
// and DSP calculations leveraging Apple's Accelerate framework
//

import Foundation // iOS 14.0+
import AVFoundation // iOS 14.0+
import Accelerate // iOS 14.0+

/// Global constants for audio processing
private let kMinimumAmplitude: Float = -50.0 // Minimum amplitude threshold in decibels
private let kMaximumAmplitude: Float = 0.0 // Maximum amplitude threshold in decibels
private let kReferenceLevel: Float = 1.0 // Reference level for decibel calculations

/// Utility class providing high-performance audio processing functions
public enum AudioUtils {
    
    /// Converts linear amplitude values to decibel scale using optimized vDSP operations
    /// - Parameter amplitude: Linear amplitude value to convert
    /// - Returns: Amplitude value in decibels, clamped between kMinimumAmplitude and kMaximumAmplitude
    @inline(__always)
    public static func convertToDecibels(amplitude: Float) -> Float {
        // Ensure non-negative amplitude
        let validAmplitude = max(amplitude, Float.leastNonzeroMagnitude)
        
        // Prepare vectorized input
        var input = [validAmplitude]
        var output = [Float](repeating: 0, count: 1)
        
        // Perform vectorized decibel conversion
        vDSP_vdbcon(input, 1, &output, 1, 1, 1)
        
        // Apply reference level scaling
        var scaledValue = output[0] + 20.0 * log10(kReferenceLevel)
        
        // Clamp result between min and max amplitude
        vDSP_vclip(&scaledValue, 1, &kMinimumAmplitude, &kMaximumAmplitude, &scaledValue, 1, 1)
        
        return scaledValue
    }
    
    /// Calculates the average power of an audio signal buffer using vectorized operations
    /// - Parameter audioBuffer: Raw audio buffer data
    /// - Returns: Average power value of the signal using RMS calculation
    @inline(__always)
    public static func calculateSignalPower(audioBuffer: Data) -> Float {
        // Convert audio buffer to float array
        let count = audioBuffer.count / MemoryLayout<Float>.stride
        var floatArray = [Float](repeating: 0, count: count)
        
        audioBuffer.withUnsafeBytes { bufferPtr in
            guard let baseAddress = bufferPtr.baseAddress else { return }
            let typedPtr = baseAddress.assumingMemoryBound(to: Float.self)
            vDSP_vflt32(typedPtr, 1, &floatArray, 1, vDSP_Length(count))
        }
        
        // Calculate squared values
        var squaredValues = [Float](repeating: 0, count: count)
        vDSP_vsq(floatArray, 1, &squaredValues, 1, vDSP_Length(count))
        
        // Calculate mean
        var mean: Float = 0
        vDSP_meanv(squaredValues, 1, &mean, vDSP_Length(count))
        
        // Calculate RMS using square root
        var rms: Float = 0
        vForce_sqrt(&mean, &rms, 1)
        
        return rms
    }
    
    /// Applies Hann window function to audio buffer for spectral analysis using vectorized operations
    /// - Parameter samples: Input audio samples
    /// - Returns: Windowed samples processed using vDSP
    @inline(__always)
    public static func applyHannWindow(samples: [Float]) -> [Float] {
        let count = vDSP_Length(samples.count)
        
        // Generate Hann window coefficients
        var window = [Float](repeating: 0, count: samples.count)
        vDSP_hann_window(&window, count, Int32(vDSP_HANN_NORM))
        
        // Apply window function
        var result = [Float](repeating: 0, count: samples.count)
        vDSP_vmul(samples, 1, window, 1, &result, 1, count)
        
        return result
    }
    
    /// Calculates spectral centroid of audio signal for feature extraction using optimized DSP
    /// - Parameters:
    ///   - magnitudes: Magnitude spectrum of the signal
    ///   - sampleRate: Audio sample rate in Hz
    /// - Returns: Spectral centroid frequency in Hz
    @inline(__always)
    public static func calculateSpectralCentroid(magnitudes: [Float], sampleRate: Float) -> Float {
        let count = vDSP_Length(magnitudes.count)
        
        // Generate frequency bins
        var frequencies = [Float](repeating: 0, count: magnitudes.count)
        var frequency: Float = 0
        let increment = sampleRate / (2.0 * Float(magnitudes.count))
        vDSP_vramp(&frequency, &increment, &frequencies, 1, count)
        
        // Calculate weighted sum
        var weightedSum = [Float](repeating: 0, count: magnitudes.count)
        vDSP_vmul(frequencies, 1, magnitudes, 1, &weightedSum, 1, count)
        
        // Calculate sums
        var numerator: Float = 0
        var denominator: Float = 0
        vDSP_sve(weightedSum, 1, &numerator, count)
        vDSP_sve(magnitudes, 1, &denominator, count)
        
        // Avoid division by zero
        guard denominator > Float.leastNonzeroMagnitude else { return 0 }
        
        // Calculate centroid
        var centroid: Float = 0
        vDSP_vsdiv(&numerator, 1, &denominator, &centroid, 1, 1)
        
        return centroid
    }
}