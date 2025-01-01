import Foundation

/// Protocol that defines the contract for background task event handling and cry detection notification
/// in the Baby Cry Analyzer iOS app.
///
/// Version: iOS 14.0+
/// - Note: Implements background monitoring capabilities as specified in technical requirements
@objc public protocol BackgroundTaskDelegate: AnyObject {
    
    /// Called when background monitoring task starts successfully
    /// - Note: Indicates the system is ready for cry detection and monitoring
    @objc func backgroundTaskDidStart()
    
    /// Called when background monitoring task stops
    /// - Parameter error: Optional error indicating reason for stopping if failure occurred
    @objc func backgroundTaskDidStop(_ error: Error?)
    
    /// Called when a cry pattern is detected during background monitoring
    /// - Parameters:
    ///   - audioData: Raw audio data of the detected cry
    ///   - confidence: Confidence score of the cry detection (0.0 to 1.0)
    ///   - timestamp: Exact time when the cry was detected
    ///   - metadata: Additional contextual information about the detection
    @objc func backgroundTaskDidDetectCry(
        _ audioData: Data,
        confidence: Double,
        timestamp: Date,
        metadata: [String: Any]
    )
}

/// Extension providing default implementations for optional helper methods
public extension BackgroundTaskDelegate {
    
    /// Validates if the confidence score meets minimum threshold for cry detection
    /// - Parameter confidence: The confidence score to validate
    /// - Returns: Boolean indicating if confidence meets threshold
    func isValidConfidence(_ confidence: Double) -> Bool {
        // As per technical specs, requiring 90% confidence for cry classification
        return confidence >= 0.90
    }
    
    /// Validates audio data integrity
    /// - Parameter audioData: The audio data to validate
    /// - Returns: Boolean indicating if audio data is valid
    func isValidAudioData(_ audioData: Data) -> Bool {
        // Minimum size for valid audio sample as per specifications
        let minimumAudioSize = 1024 // 1KB
        return audioData.count >= minimumAudioSize
    }
    
    /// Formats metadata dictionary for consistent storage
    /// - Parameter metadata: Raw metadata dictionary
    /// - Returns: Processed metadata dictionary
    func processMetadata(_ metadata: [String: Any]) -> [String: Any] {
        var processedMetadata = metadata
        // Add standard fields required for analysis
        processedMetadata["processingTimestamp"] = Date()
        processedMetadata["backgroundProcessingVersion"] = "1.0"
        return processedMetadata
    }
}