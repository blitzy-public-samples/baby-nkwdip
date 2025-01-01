//
// AudioRecorderService.swift
// BabyCryAnalyzer
//
// Enhanced service class managing audio recording functionality with robust error handling and monitoring
// Foundation: iOS 14.0+
// AVFoundation: iOS 14.0+
//

import Foundation
import AVFoundation

// MARK: - Constants
private let kRecordingStateKey = "recording_state"
private let kMaxRecordingDuration: TimeInterval = 3600.0 // 1 hour
private let kRetryAttempts = 3
private let kRetryDelay: TimeInterval = 1.0

// MARK: - RecordingError
public enum RecordingError: Error {
    case alreadyRecording
    case notRecording
    case audioSessionError
    case processorError
    case configurationError
    case permissionDenied
    case timeout
    case qualityTooLow
    case powerEfficiencyLow
}

// MARK: - RecordingMetadata
public struct RecordingMetadata {
    let duration: TimeInterval
    let averageQuality: Float
    let powerEfficiency: Float
    let noiseLevel: Float
    let timestamp: Date
}

// MARK: - AudioRecorderService
@objc public class AudioRecorderService: NSObject {
    
    // MARK: - Public Properties
    public private(set) var isRecording: Bool = false
    public private(set) var recordingQuality: Float = 0.0
    public private(set) var powerEfficiency: Float = 1.0
    
    // MARK: - Private Properties
    private let configuration: AudioConfiguration
    private let audioProcessor: AudioProcessor
    private let notificationCenter: NotificationCenter
    private let qualityMonitor: AudioQualityMonitor
    private let powerMonitor: PowerMonitor
    private let stateManager: RecordingStateManager
    
    private var recordingTimer: Timer?
    private var retryCount: Int = 0
    private var startTime: Date?
    
    // MARK: - Initialization
    public init(config: AudioConfiguration) throws {
        self.configuration = config
        self.audioProcessor = try AudioProcessor(config: config)
        self.notificationCenter = NotificationCenter.default
        self.qualityMonitor = AudioQualityMonitor()
        self.powerMonitor = PowerMonitor()
        self.stateManager = RecordingStateManager()
        
        super.init()
        
        setupNotificationObservers()
        audioProcessor.delegate = self
    }
    
    deinit {
        cleanupResources()
    }
    
    // MARK: - Public Methods
    public func startRecording() -> Result<Void, RecordingError> {
        guard !isRecording else {
            return .failure(.alreadyRecording)
        }
        
        // Check microphone permission
        switch AVAudioSession.sharedInstance().recordPermission {
        case .denied, .undetermined:
            return .failure(.permissionDenied)
        case .granted:
            break
        @unknown default:
            return .failure(.permissionDenied)
        }
        
        // Start recording with retry logic
        return startRecordingWithRetry()
    }
    
    public func stopRecording() -> Result<RecordingMetadata, RecordingError> {
        guard isRecording else {
            return .failure(.notRecording)
        }
        
        // Stop monitoring and recording
        qualityMonitor.stopMonitoring()
        powerMonitor.stopMonitoring()
        
        switch audioProcessor.stopRecording() {
        case .success:
            isRecording = false
            recordingTimer?.invalidate()
            
            let metadata = RecordingMetadata(
                duration: Date().timeIntervalSince(startTime ?? Date()),
                averageQuality: qualityMonitor.averageQuality,
                powerEfficiency: powerMonitor.efficiency,
                noiseLevel: qualityMonitor.noiseLevel,
                timestamp: startTime ?? Date()
            )
            
            stateManager.updateState(isRecording: false)
            notificationCenter.post(name: .recordingDidStop, object: self)
            
            return .success(metadata)
            
        case .failure:
            return .failure(.processorError)
        }
    }
    
    // MARK: - Private Methods
    private func startRecordingWithRetry() -> Result<Void, RecordingError> {
        let result = audioProcessor.startRecording()
        
        switch result {
        case .success:
            isRecording = true
            startTime = Date()
            retryCount = 0
            
            // Start monitoring
            qualityMonitor.startMonitoring()
            powerMonitor.startMonitoring()
            
            // Configure recording timeout
            setupRecordingTimer()
            
            stateManager.updateState(isRecording: true)
            notificationCenter.post(name: .recordingDidStart, object: self)
            
            return .success(())
            
        case .failure:
            if retryCount < kRetryAttempts {
                retryCount += 1
                DispatchQueue.main.asyncAfter(deadline: .now() + kRetryDelay) { [weak self] in
                    _ = self?.startRecordingWithRetry()
                }
                return .success(())
            }
            return .failure(.processorError)
        }
    }
    
    private func setupNotificationObservers() {
        notificationCenter.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        
        notificationCenter.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        
        notificationCenter.addObserver(
            self,
            selector: #selector(handleMediaServicesReset(_:)),
            name: AVAudioSession.mediaServicesWereResetNotification,
            object: nil
        )
    }
    
    private func setupRecordingTimer() {
        recordingTimer = Timer.scheduledTimer(
            withTimeInterval: kMaxRecordingDuration,
            repeats: false
        ) { [weak self] _ in
            self?.handleRecordingTimeout()
        }
    }
    
    private func handleRecordingTimeout() {
        _ = stopRecording()
        notificationCenter.post(name: .recordingDidTimeout, object: self)
    }
    
    private func cleanupResources() {
        notificationCenter.removeObserver(self)
        recordingTimer?.invalidate()
        qualityMonitor.stopMonitoring()
        powerMonitor.stopMonitoring()
        _ = stopRecording()
    }
    
    // MARK: - Notification Handlers
    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }
        
        switch type {
        case .began:
            _ = stopRecording()
        case .ended:
            guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else {
                return
            }
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
            if options.contains(.shouldResume) {
                _ = startRecording()
            }
        @unknown default:
            break
        }
    }
    
    @objc private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }
        
        switch reason {
        case .oldDeviceUnavailable:
            _ = stopRecording()
        case .newDeviceAvailable:
            if isRecording {
                _ = startRecording()
            }
        default:
            break
        }
    }
    
    @objc private func handleMediaServicesReset(_ notification: Notification) {
        if isRecording {
            _ = stopRecording()
            _ = startRecording()
        }
    }
}

// MARK: - AudioProcessorDelegate
extension AudioRecorderService: AudioProcessorDelegate {
    public func audioProcessorDidStartRecording() {
        notificationCenter.post(name: .recordingDidStart, object: self)
    }
    
    public func audioProcessorDidStopRecording() {
        notificationCenter.post(name: .recordingDidStop, object: self)
    }
    
    public func audioProcessor(didDetectAudioLevel audioLevel: Float) {
        recordingQuality = qualityMonitor.processAudioLevel(audioLevel)
        powerEfficiency = powerMonitor.currentEfficiency
    }
    
    public func audioProcessorDidDetectCry(patternType: String, confidence: Float) {
        notificationCenter.post(
            name: .cryPatternDetected,
            object: self,
            userInfo: [
                "patternType": patternType,
                "confidence": confidence
            ]
        )
    }
}

// MARK: - Notification Names
public extension Notification.Name {
    static let recordingDidStart = Notification.Name("AudioRecorderServiceRecordingDidStart")
    static let recordingDidStop = Notification.Name("AudioRecorderServiceRecordingDidStop")
    static let recordingDidTimeout = Notification.Name("AudioRecorderServiceRecordingDidTimeout")
    static let cryPatternDetected = Notification.Name("AudioRecorderServiceCryPatternDetected")
}