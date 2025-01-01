//
// AppDelegate.swift
// BabyCryAnalyzer
//
// Main application delegate managing app lifecycle and core services
// Foundation: iOS 14.0+
//

import UIKit
import React
import BackgroundTasks
import AVFoundation

// MARK: - Constants
private let kBackgroundTaskIdentifier = "com.babycryanalyzer.backgroundMonitoring"
private let kAudioConfigValidationTimeout = 5.0
private let kBridgeInitializationTimeout = 10.0

@main
@objc
@available(iOS 14.0, *)
class AppDelegate: UIResponder, UIApplicationDelegate, BackgroundTaskDelegate {
    
    // MARK: - Properties
    var window: UIWindow?
    private var backgroundService: BackgroundMonitoringService!
    private var audioConfig: AudioConfiguration!
    private var bridgeInitialized: Bool = false
    private var lastError: Error?
    
    // MARK: - UIApplicationDelegate
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Validate iOS version requirements
        guard #available(iOS 14.0, *) else {
            fatalError("Application requires iOS 14.0 or later")
        }
        
        // Initialize audio configuration with validation
        audioConfig = AudioConfiguration(
            sampleRate: 44100.0,
            bufferSize: 4096,
            noiseThreshold: -50.0,
            cryDetectionThreshold: 0.85
        )
        
        // Configure audio session with timeout
        let audioConfigResult = DispatchQueue.main.sync {
            return audioConfig.configureAudioSession()
        }
        
        switch audioConfigResult {
        case .success:
            print("Audio session configured successfully")
        case .failure(let error):
            handleAudioConfigurationError(error)
            return false
        }
        
        // Register background task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: kBackgroundTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleBackgroundTask(task as! BGProcessingTask)
        }
        
        // Initialize background monitoring service
        do {
            backgroundService = try BackgroundMonitoringService(
                config: BackgroundConfiguration(),
                processor: AudioProcessor(config: audioConfig)
            )
            backgroundService.delegate = self
        } catch {
            print("Failed to initialize background service: \(error)")
            return false
        }
        
        // Initialize React Native bridge with timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + kBridgeInitializationTimeout) { [weak self] in
            if !self?.bridgeInitialized ?? false {
                self?.lastError = NSError(
                    domain: "com.babycryanalyzer",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Bridge initialization timeout"]
                )
            }
        }
        
        return true
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        // Start background monitoring with battery optimization
        let monitoringResult = backgroundService.startMonitoring()
        
        switch monitoringResult {
        case .success:
            print("Background monitoring started successfully")
        case .failure(let error):
            print("Failed to start background monitoring: \(error)")
            handleBackgroundMonitoringError(error)
        }
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        // Stop background monitoring and restore normal operation
        backgroundService.stopMonitoring()
        
        // Revalidate audio configuration
        let configResult = audioConfig.configureAudioSession()
        if case .failure(let error) = configResult {
            handleAudioConfigurationError(error)
        }
    }
    
    // MARK: - Private Methods
    
    private func handleBackgroundTask(_ task: BGProcessingTask) {
        // Set expiration handler
        task.expirationHandler = { [weak self] in
            self?.backgroundService.stopMonitoring()
            task.setTaskCompleted(success: false)
        }
        
        // Start monitoring with battery optimization
        let monitoringResult = backgroundService.startMonitoring()
        
        switch monitoringResult {
        case .success:
            task.setTaskCompleted(success: true)
        case .failure(let error):
            handleBackgroundMonitoringError(error)
            task.setTaskCompleted(success: false)
        }
    }
    
    private func handleAudioConfigurationError(_ error: Error) -> Bool {
        print("Audio configuration error: \(error)")
        
        // Attempt recovery based on error type
        if let configError = error as? AudioConfigurationError {
            switch configError {
            case .audioSessionConfigurationFailed:
                // Retry configuration with default settings
                let retryResult = audioConfig.configureAudioSession()
                return retryResult.isSuccess
                
            case .invalidSampleRate, .invalidBufferSize:
                // Reset to default configuration
                audioConfig = AudioConfiguration()
                let resetResult = audioConfig.configureAudioSession()
                return resetResult.isSuccess
                
            default:
                return false
            }
        }
        
        return false
    }
    
    private func handleBackgroundMonitoringError(_ error: MonitoringError) {
        print("Background monitoring error: \(error)")
        
        switch error {
        case .lowBattery:
            // Stop monitoring until battery level improves
            backgroundService.stopMonitoring()
            
        case .quotaExceeded:
            // Adjust monitoring interval and retry
            let config = BackgroundConfiguration()
            _ = config.setMonitoringInterval(900) // 15 minutes
            backgroundService.stopMonitoring()
            _ = backgroundService.startMonitoring()
            
        default:
            backgroundService.stopMonitoring()
        }
    }
    
    // MARK: - BackgroundTaskDelegate
    
    func backgroundTaskDidStart() {
        print("Background task started successfully")
    }
    
    func backgroundTaskDidStop(_ error: Error?) {
        if let error = error {
            print("Background task stopped with error: \(error)")
        } else {
            print("Background task stopped normally")
        }
    }
    
    func backgroundTaskDidDetectCry(_ audioData: Data, confidence: Double, timestamp: Date, metadata: [String : Any]) {
        // Handle cry detection in background mode
        print("Cry detected with confidence: \(confidence)")
        
        // Schedule local notification if needed
        if confidence >= 0.90 {
            let content = UNMutableNotificationContent()
            content.title = "Baby Cry Detected"
            content.body = "High confidence cry pattern detected"
            content.sound = .default
            
            let request = UNNotificationRequest(
                identifier: UUID().uuidString,
                content: content,
                trigger: nil
            )
            
            UNUserNotificationCenter.current().add(request)
        }
    }
}