//
// AudioCaptureModule.swift
// BabyCryAnalyzer
//
// React Native bridge module for iOS audio capture with enhanced error handling
// and performance monitoring capabilities.
//
// Foundation: iOS 14.0+
// React: 0.71+
//

import Foundation
import React

// MARK: - Constants
private let kModuleName = "AudioCaptureModule"
private let kEventAudioLevelUpdate = "onAudioLevelUpdate"
private let kEventCryDetected = "onCryDetected"
private let kEventError = "onError"
private let kEventMetricsUpdate = "onMetricsUpdate"

// MARK: - AudioCaptureModule
@objc(AudioCaptureModule)
class AudioCaptureModule: RCTEventEmitter {
    
    // MARK: - Private Properties
    private var audioProcessor: AudioProcessor?
    private var configuration: AudioConfiguration
    private var hasListeners: Bool = false
    private let processingQueue: DispatchQueue
    private let stateLock: NSLock
    private var metrics: ProcessingMetrics
    
    // MARK: - Initialization
    override init() {
        self.configuration = AudioConfiguration(
            sampleRate: 44100.0,
            bufferSize: 4096,
            noiseThreshold: -50.0,
            cryDetectionThreshold: 0.85
        )
        self.processingQueue = DispatchQueue(label: "com.babycryanalyzer.capture", qos: .userInitiated)
        self.stateLock = NSLock()
        self.metrics = ProcessingMetrics()
        
        super.init()
        
        // Initialize audio processor with configuration
        do {
            self.audioProcessor = try AudioProcessor(config: configuration)
            self.audioProcessor?.delegate = self
        } catch {
            print("Failed to initialize AudioProcessor: \(error)")
        }
    }
    
    // MARK: - RCTEventEmitter Override
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String] {
        return [
            kEventAudioLevelUpdate,
            kEventCryDetected,
            kEventError,
            kEventMetricsUpdate
        ]
    }
    
    override func startObserving() {
        stateLock.lock()
        hasListeners = true
        stateLock.unlock()
    }
    
    override func stopObserving() {
        stateLock.lock()
        hasListeners = false
        stateLock.unlock()
    }
    
    // MARK: - Public Methods
    @objc(startRecording:withRejecter:)
    func startRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                       withRejecter reject: @escaping RCTPromiseRejectBlock) {
        processingQueue.async { [weak self] in
            guard let self = self else {
                reject("ERROR", "Module deallocated", nil)
                return
            }
            
            guard let audioProcessor = self.audioProcessor else {
                reject("INIT_ERROR", "Audio processor not initialized", nil)
                return
            }
            
            switch audioProcessor.startRecording() {
            case .success:
                self.metrics.startMonitoring()
                resolve(["status": "recording"])
                
            case .failure(let error):
                self.sendEvent(withName: kEventError, body: [
                    "code": "RECORDING_ERROR",
                    "message": error.localizedDescription
                ])
                reject("RECORDING_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    @objc(stopRecording:withRejecter:)
    func stopRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                      withRejecter reject: @escaping RCTPromiseRejectBlock) {
        processingQueue.async { [weak self] in
            guard let self = self else {
                reject("ERROR", "Module deallocated", nil)
                return
            }
            
            self.stateLock.lock()
            defer { self.stateLock.unlock() }
            
            self.audioProcessor?.stopRecording()
            self.metrics.stopMonitoring()
            
            resolve(["status": "stopped", "metrics": self.metrics.summary])
        }
    }
    
    @objc(isRecording:withRejecter:)
    func isRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                    withRejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(["recording": audioProcessor?.isRecording ?? false])
    }
    
    @objc(getMetrics:withRejecter:)
    func getMetrics(_ resolve: @escaping RCTPromiseResolveBlock,
                   withRejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(metrics.current)
    }
}

// MARK: - AudioProcessorDelegate
extension AudioCaptureModule: AudioProcessorDelegate {
    func audioProcessorDidStartRecording() {
        guard hasListeners else { return }
        sendEvent(withName: kEventMetricsUpdate, body: ["status": "recording"])
    }
    
    func audioProcessorDidStopRecording() {
        guard hasListeners else { return }
        sendEvent(withName: kEventMetricsUpdate, body: ["status": "stopped"])
    }
    
    func audioProcessor(didDetectAudioLevel audioLevel: Float) {
        guard hasListeners else { return }
        sendEvent(withName: kEventAudioLevelUpdate, body: ["level": audioLevel])
    }
    
    func audioProcessorDidDetectCry(patternType: String, confidence: Float) {
        guard hasListeners else { return }
        sendEvent(withName: kEventCryDetected, body: [
            "type": patternType,
            "confidence": confidence,
            "timestamp": Date().timeIntervalSince1970
        ])
    }
}

// MARK: - ProcessingMetrics
private struct ProcessingMetrics {
    private var startTime: Date?
    private var processingStats: [String: Any] = [:]
    
    mutating func startMonitoring() {
        startTime = Date()
        processingStats = [:]
    }
    
    mutating func stopMonitoring() {
        startTime = nil
    }
    
    var current: [String: Any] {
        var metrics: [String: Any] = processingStats
        if let start = startTime {
            metrics["duration"] = Date().timeIntervalSince(start)
        }
        return metrics
    }
    
    var summary: [String: Any] {
        var summary = current
        summary["completed"] = true
        return summary
    }
}