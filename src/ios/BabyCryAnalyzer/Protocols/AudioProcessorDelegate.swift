// Foundation framework - iOS 14.0+
import Foundation

/// Protocol defining the delegate interface for audio processing events and cry detection callbacks.
/// Ensures real-time communication between audio processing components and UI layers while maintaining
/// high performance and thread safety.
@objc public protocol AudioProcessorDelegate: AnyObject {
    
    /// Called when the audio processor begins recording.
    /// Must be executed on the main thread for UI updates.
    ///
    /// Implementation should:
    /// - Update UI state for recording mode
    /// - Initialize audio visualization resources
    /// - Start audio level monitoring
    /// - Configure noise cancellation if enabled
    @objc required func audioProcessorDidStartRecording()
    
    /// Called when the audio processor stops recording.
    /// Handles cleanup and resource management.
    ///
    /// Implementation should:
    /// - Stop audio level monitoring
    /// - Release audio visualization resources
    /// - Update UI state to idle mode
    /// - Perform final cleanup of audio session
    @objc required func audioProcessorDidStopRecording()
    
    /// Called when the audio processor detects audio levels or noise.
    /// Optimized for UI refresh rates.
    ///
    /// - Parameter audioLevel: Current audio level, normalized between 0.0 and 1.0
    ///
    /// Implementation should:
    /// - Apply noise filtering algorithm
    /// - Update audio visualization with debouncing
    /// - Update noise level indicators
    /// - Check threshold for potential cry detection
    @objc required func audioProcessor(didDetectAudioLevel audioLevel: Float)
    
    /// Called when a cry pattern is detected with analysis results.
    ///
    /// - Parameters:
    ///   - patternType: The classified type of cry pattern detected
    ///   - confidence: Confidence score of the detection (0.0 to 1.0)
    ///
    /// Implementation should:
    /// - Verify confidence meets minimum threshold (>= 0.6)
    /// - Validate pattern type against known categories
    /// - Update UI with detection results
    /// - Trigger local notifications if enabled
    /// - Log detection event for history
    /// - Store pattern data for ML training
    @objc required func audioProcessorDidDetectCry(patternType: String, confidence: Float)
}

// MARK: - Default Implementation Extensions

public extension AudioProcessorDelegate {
    
    /// Thread safety check for main thread execution
    func assertMainThread() {
        assert(Thread.isMainThread, "AudioProcessorDelegate methods must be called on the main thread")
    }
}