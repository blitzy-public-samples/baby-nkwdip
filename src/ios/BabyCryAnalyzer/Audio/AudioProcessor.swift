//
// AudioProcessor.swift
// BabyCryAnalyzer
//
// Core audio processing class for real-time cry pattern detection
// Foundation: iOS 14.0+
// AVFoundation: iOS 14.0+
// Accelerate: iOS 14.0+
//

import Foundation
import AVFoundation
import Accelerate

// MARK: - Constants
private let kDefaultFeatureWindowSize: Int = 2048
private let kMinimumCryDuration: TimeInterval = 1.5
private let kFeatureExtractionInterval: TimeInterval = 0.1
private let kMaxBufferAge: TimeInterval = 5.0
private let kProcessingQueueLabel = "com.babycryanalyzer.audioprocessing"

// MARK: - AudioProcessorError
public enum AudioProcessorError: Error {
    case invalidConfiguration
    case audioEngineError
    case sessionConfigurationError
    case alreadyRecording
    case notRecording
    case bufferProcessingError
}

// MARK: - AudioProcessorState
public enum AudioProcessorState {
    case idle
    case recording
    case processing
    case error(AudioProcessorError)
}

// MARK: - AudioProcessor Class
@objc
@available(iOS 14.0, *)
public class AudioProcessor: NSObject {
    
    // MARK: - Public Properties
    public weak var delegate: AudioProcessorDelegate?
    public private(set) var isRecording: Bool = false
    public private(set) var currentState: AudioProcessorState = .idle {
        didSet {
            DispatchQueue.main.async { [weak self] in
                self?.updateDelegateForState()
            }
        }
    }
    
    // MARK: - Private Properties
    private let configuration: AudioConfiguration
    private let noiseFilter: NoiseFilter
    private let audioEngine: AVAudioEngine
    private var inputNode: AVAudioInputNode
    private let processingQueue: DispatchQueue
    private let stateLock: NSLock
    
    private var audioBufferCache: [AVAudioPCMBuffer] = []
    private var lastProcessingTime: TimeInterval = 0
    private var cryDetectionStartTime: TimeInterval?
    private var installTapCalled = false
    
    // MARK: - Initialization
    public init(config: AudioConfiguration) throws {
        self.configuration = config
        self.noiseFilter = NoiseFilter(config: config)
        self.audioEngine = AVAudioEngine()
        self.inputNode = audioEngine.inputNode
        self.processingQueue = DispatchQueue(label: kProcessingQueueLabel, qos: .userInitiated)
        self.stateLock = NSLock()
        
        super.init()
        
        // Validate configuration
        guard config.isConfigurationValid else {
            throw AudioProcessorError.invalidConfiguration
        }
        
        // Setup audio session notification observers
        setupNotificationObservers()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        stopRecording()
    }
    
    // MARK: - Public Methods
    @discardableResult
    public func startRecording() -> Result<Void, AudioProcessorError> {
        stateLock.lock()
        defer { stateLock.unlock() }
        
        guard !isRecording else {
            return .failure(.alreadyRecording)
        }
        
        // Configure audio session
        switch configuration.configureAudioSession() {
        case .success:
            break
        case .failure:
            return .failure(.sessionConfigurationError)
        }
        
        do {
            // Configure input format
            let inputFormat = inputNode.inputFormat(forBus: 0)
            let processingFormat = AVAudioFormat(
                standardFormatWithSampleRate: configuration.sampleRate,
                channels: AVAudioChannelCount(configuration.numberOfChannels)
            )
            
            guard let format = processingFormat else {
                return .failure(.audioEngineError)
            }
            
            // Install tap on input node
            if !installTapCalled {
                inputNode.installTap(
                    onBus: 0,
                    bufferSize: UInt32(configuration.bufferSize),
                    format: inputFormat
                ) { [weak self] buffer, time in
                    self?.processAudioBuffer(buffer, time: time)
                }
                installTapCalled = true
            }
            
            // Start audio engine
            try audioEngine.start()
            
            isRecording = true
            currentState = .recording
            
            return .success(())
            
        } catch {
            currentState = .error(.audioEngineError)
            return .failure(.audioEngineError)
        }
    }
    
    public func stopRecording() {
        stateLock.lock()
        defer { stateLock.unlock() }
        
        guard isRecording else { return }
        
        if installTapCalled {
            inputNode.removeTap(onBus: 0)
            installTapCalled = false
        }
        
        audioEngine.stop()
        audioBufferCache.removeAll()
        noiseFilter.reset()
        
        isRecording = false
        currentState = .idle
    }
    
    // MARK: - Private Methods
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        guard isRecording else { return }
        
        processingQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.currentState = .processing
            
            // Convert buffer to Data for noise filtering
            guard let channelData = buffer.floatChannelData?[0],
                  let filteredData = try? self.filterAndProcessBuffer(channelData, frameLength: buffer.frameLength) else {
                self.currentState = .error(.bufferProcessingError)
                return
            }
            
            // Extract features and detect patterns
            let features = self.extractFeatures(from: filteredData)
            self.detectCryPattern(features: features, timestamp: time.timeIntervalSinceNow)
            
            // Update audio levels
            let level = self.calculateAudioLevel(from: filteredData)
            DispatchQueue.main.async {
                self.delegate?.audioProcessor(didDetectAudioLevel: level)
            }
            
            self.currentState = .recording
        }
    }
    
    private func filterAndProcessBuffer(_ buffer: UnsafePointer<Float>, frameLength: UInt32) throws -> Data {
        let data = Data(bytes: buffer, count: Int(frameLength) * MemoryLayout<Float>.size)
        return noiseFilter.processBuffer(data)
    }
    
    private func extractFeatures(from data: Data) -> [Float] {
        var features = [Float](repeating: 0.0, count: kDefaultFeatureWindowSize)
        data.withUnsafeBytes { bufferPtr in
            // Perform feature extraction using vDSP
            let floatPtr = bufferPtr.bindMemory(to: Float.self)
            vDSP_maxv(floatPtr.baseAddress!, 1, &features, vDSP_Length(kDefaultFeatureWindowSize))
        }
        return features
    }
    
    private func detectCryPattern(features: [Float], timestamp: TimeInterval) {
        let currentTime = timestamp
        
        // Check if enough time has passed since last processing
        guard (currentTime - lastProcessingTime) >= kFeatureExtractionInterval else {
            return
        }
        
        // Pattern detection logic
        let patternConfidence = analyzeCryPattern(features)
        
        if patternConfidence >= configuration.cryDetectionThreshold {
            if cryDetectionStartTime == nil {
                cryDetectionStartTime = currentTime
            }
            
            // Verify minimum cry duration
            if let startTime = cryDetectionStartTime,
               (currentTime - startTime) >= kMinimumCryDuration {
                DispatchQueue.main.async { [weak self] in
                    self?.delegate?.audioProcessorDidDetectCry(
                        patternType: "infant_cry",
                        confidence: patternConfidence
                    )
                }
            }
        } else {
            cryDetectionStartTime = nil
        }
        
        lastProcessingTime = currentTime
    }
    
    private func analyzeCryPattern(_ features: [Float]) -> Float {
        // Advanced pattern analysis using feature vector
        var confidence: Float = 0.0
        vDSP_meanv(features, 1, &confidence, vDSP_Length(features.count))
        return confidence
    }
    
    private func calculateAudioLevel(from data: Data) -> Float {
        var level: Float = 0.0
        data.withUnsafeBytes { bufferPtr in
            let floatPtr = bufferPtr.bindMemory(to: Float.self)
            vDSP_rmsqv(floatPtr.baseAddress!, 1, &level, vDSP_Length(data.count / MemoryLayout<Float>.size))
        }
        return level
    }
    
    private func updateDelegateForState() {
        switch currentState {
        case .recording:
            delegate?.audioProcessorDidStartRecording()
        case .idle:
            delegate?.audioProcessorDidStopRecording()
        case .error(let error):
            delegate?.audioProcessorDidEncounterError?(error)
        default:
            break
        }
    }
    
    private func setupNotificationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }
    
    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }
        
        switch type {
        case .began:
            stopRecording()
        case .ended:
            guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else {
                return
            }
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
            if options.contains(.shouldResume) {
                _ = try? startRecording()
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
            stopRecording()
        case .newDeviceAvailable:
            _ = try? startRecording()
        default:
            break
        }
    }
}