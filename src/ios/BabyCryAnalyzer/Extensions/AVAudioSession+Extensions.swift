import Foundation
import AVFoundation

// MARK: - Constants
private let kDefaultSampleRate: Double = 44100.0
private let kDefaultIOBufferDuration: TimeInterval = 0.005
private let kDefaultPreferredLatency: TimeInterval = 0.005

// MARK: - AVAudioSession Extension
extension AVAudioSession {
    
    /// Configures audio session with optimal settings for cry analysis including high-quality recording mode and minimal latency
    /// - Throws: Error if configuration fails
    /// - Returns: Result indicating success or failure with error details
    public func configureCryAnalysis() throws -> Result<Void, Error> {
        do {
            // Configure session category for recording with bluetooth support
            try setCategory(.playAndRecord, options: [.allowBluetooth, .defaultToSpeaker])
            
            // Set mode to measurement for highest quality recording
            try setMode(.measurement)
            
            // Configure optimal sample rate for cry frequency capture
            try setPreferredSampleRate(kDefaultSampleRate)
            
            // Set minimal IO buffer duration for real-time processing
            try setPreferredIOBufferDuration(kDefaultIOBufferDuration)
            
            // Configure minimal latency for input/output
            try setPreferredInputLatency(kDefaultPreferredLatency)
            try setPreferredOutputLatency(kDefaultPreferredLatency)
            
            // Activate the session
            try setActive(true)
            
            return .success(())
        } catch {
            return .failure(error)
        }
    }
    
    /// Configures audio session for reliable background operation with mixing capabilities
    /// - Throws: Error if configuration fails
    /// - Returns: Result indicating success or failure with error details
    public func configureBackgroundMode() throws -> Result<Void, Error> {
        do {
            // Configure category options for background operation
            try setCategory(.playAndRecord, options: [
                .mixWithOthers,
                .allowBluetooth,
                .defaultToSpeaker,
                .allowBackgroundOperation
            ])
            
            // Set mode for background processing
            try setMode(.measurement)
            
            // Activate session with background capabilities
            try setActive(true, options: .setActiveFlags)
            
            return .success(())
        } catch {
            return .failure(error)
        }
    }
    
    /// Manages audio session interruptions with robust state recovery
    /// - Parameter notification: Notification containing interruption information
    public func handleInterruption(_ notification: NSNotification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSessionInterruptionType(rawValue: typeValue) else {
            return
        }
        
        switch type {
        case .began:
            // Handle interruption start
            do {
                try setActive(false)
            } catch {
                print("Failed to deactivate audio session: \(error.localizedDescription)")
            }
            
        case .ended:
            // Handle interruption end
            guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else {
                return
            }
            let options = AVAudioSessionInterruptionOptions(rawValue: optionsValue)
            
            if options.contains(.shouldResume) {
                do {
                    try setActive(true)
                } catch {
                    print("Failed to reactivate audio session: \(error.localizedDescription)")
                }
            }
            
        @unknown default:
            print("Unknown interruption type received")
        }
    }
    
    /// Handles microphone permission request with comprehensive error handling
    /// - Parameter completion: Closure called with permission result
    public func requestRecordPermission(_ completion: @escaping (Bool) -> Void) {
        switch recordPermission {
        case .granted:
            completion(true)
            
        case .denied:
            completion(false)
            
        case .undetermined:
            // Request permission if not determined
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async {
                    completion(granted)
                }
            }
            
        @unknown default:
            completion(false)
        }
    }
}