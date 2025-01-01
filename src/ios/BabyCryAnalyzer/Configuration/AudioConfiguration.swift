//
// AudioConfiguration.swift
// BabyCryAnalyzer
//
// Audio configuration manager providing optimized settings for cry analysis
// Foundation: iOS 14.0+
// AVFoundation: iOS 14.0+
//

import Foundation
import AVFoundation

// MARK: - Global Constants
private let kDefaultSampleRate: Double = 44100.0
private let kDefaultBufferSize: Int = 4096
private let kDefaultNoiseThreshold: Double = -50.0
private let kDefaultCryDetectionThreshold: Double = 0.85
private let kDefaultNumberOfChannels: Int = 1
private let kDefaultMinimumCryDuration: TimeInterval = 1.5

private let kMaxSampleRate: Double = 48000.0
private let kMinSampleRate: Double = 8000.0
private let kMaxNoiseThreshold: Double = -20.0
private let kMinNoiseThreshold: Double = -60.0

// MARK: - Audio Configuration Errors
enum AudioConfigurationError: Error {
    case invalidSampleRate
    case invalidBufferSize
    case invalidNoiseThreshold
    case invalidCryDetectionThreshold
    case audioSessionConfigurationFailed
    case audioSessionActivationFailed
}

// MARK: - AudioConfiguration Class
@objc public class AudioConfiguration: NSObject {
    
    // MARK: - Public Properties
    public private(set) var sampleRate: Double
    public private(set) var bufferSize: Int
    public private(set) var noiseThreshold: Double
    public private(set) var cryDetectionThreshold: Double
    public private(set) var numberOfChannels: Int
    public private(set) var minimumCryDuration: TimeInterval
    public private(set) var isConfigurationValid: Bool = false
    
    // MARK: - Initialization
    public init(sampleRate: Double? = nil,
                bufferSize: Int? = nil,
                noiseThreshold: Double? = nil,
                cryDetectionThreshold: Double? = nil,
                minimumCryDuration: TimeInterval? = nil) {
        
        // Initialize with provided values or defaults
        self.sampleRate = sampleRate ?? kDefaultSampleRate
        self.bufferSize = bufferSize ?? kDefaultBufferSize
        self.noiseThreshold = noiseThreshold ?? kDefaultNoiseThreshold
        self.cryDetectionThreshold = cryDetectionThreshold ?? kDefaultCryDetectionThreshold
        self.numberOfChannels = kDefaultNumberOfChannels
        self.minimumCryDuration = minimumCryDuration ?? kDefaultMinimumCryDuration
        
        super.init()
        
        // Perform initial validation
        self.isConfigurationValid = validateConfiguration()
    }
    
    // MARK: - Public Methods
    public func configureAudioSession() -> Result<Void, Error> {
        guard validateConfiguration() else {
            return .failure(AudioConfigurationError.invalidSampleRate)
        }
        
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            // Configure session category for recording with speaker output
            try audioSession.setCategory(.playAndRecord,
                                       mode: .measurement,
                                       options: [.defaultToSpeaker, .allowBluetooth])
            
            // Set preferred sample rate
            try audioSession.setPreferredSampleRate(sampleRate)
            
            // Calculate and set optimal buffer duration
            let bufferDuration = TimeInterval(bufferSize) / TimeInterval(sampleRate)
            try audioSession.setPreferredIOBufferDuration(bufferDuration)
            
            // Configure input for mono recording
            if let preferredInput = audioSession.availableInputs?.first {
                try audioSession.setPreferredInput(preferredInput)
                try preferredInput.setPreferredDataSource(preferredInput.dataSources?.first)
            }
            
            // Activate the audio session
            try audioSession.setActive(true)
            
            // Verify configuration
            guard abs(audioSession.sampleRate - sampleRate) < 100.0 else {
                return .failure(AudioConfigurationError.audioSessionConfigurationFailed)
            }
            
            return .success(())
            
        } catch {
            return .failure(error)
        }
    }
    
    // MARK: - Private Methods
    private func validateConfiguration() -> Bool {
        // Validate sample rate
        guard sampleRate >= kMinSampleRate && sampleRate <= kMaxSampleRate else {
            return false
        }
        
        // Validate buffer size (must be power of 2 and at least 512)
        let isPowerOfTwo = (bufferSize & (bufferSize - 1)) == 0
        guard isPowerOfTwo && bufferSize >= 512 else {
            return false
        }
        
        // Validate noise threshold
        guard noiseThreshold >= kMinNoiseThreshold && noiseThreshold <= kMaxNoiseThreshold else {
            return false
        }
        
        // Validate cry detection threshold
        guard cryDetectionThreshold > 0.0 && cryDetectionThreshold <= 1.0 else {
            return false
        }
        
        // Validate minimum cry duration
        guard minimumCryDuration >= 0.5 else {
            return false
        }
        
        // Validate channel configuration
        guard numberOfChannels == kDefaultNumberOfChannels else {
            return false
        }
        
        return true
    }
}