//
// SceneDelegate.swift
// BabyCryAnalyzer
//
// Scene delegate managing UI lifecycle and audio monitoring states
// UIKit: iOS 14.0+
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    // MARK: - Properties
    var window: UIWindow?
    private let audioConfig = AudioConfiguration()
    private var isMonitoringEnabled: Bool = false {
        didSet {
            UserDefaults.standard.set(isMonitoringEnabled, forKey: "isMonitoringEnabled")
        }
    }
    
    // MARK: - Scene Lifecycle Methods
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // Configure window and root view controller
        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = .systemBackground
        
        // Set root view controller (assuming main storyboard)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let rootViewController = storyboard.instantiateInitialViewController() {
            window?.rootViewController = rootViewController
        }
        
        window?.makeKeyAndVisible()
        
        // Configure initial audio session
        configureInitialAudioSession()
        
        // Restore previous monitoring state
        isMonitoringEnabled = UserDefaults.standard.bool(forKey: "isMonitoringEnabled")
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        // Configure audio session for active state
        let result = audioConfig.configureAudioSession()
        switch result {
        case .success:
            if isMonitoringEnabled {
                resumeAudioMonitoring()
            }
        case .failure(let error):
            handleAudioConfigurationError(error)
        }
        
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("SceneDidBecomeActive"),
            object: nil
        )
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        // Save current monitoring state
        UserDefaults.standard.synchronize()
        
        // Prepare for background if monitoring is enabled
        if isMonitoringEnabled {
            prepareForBackground()
        }
        
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("SceneWillResignActive"),
            object: nil
        )
    }
    
    func sceneDidEnterBackground(_ scene: UIScene) {
        if isMonitoringEnabled {
            // Configure background audio session
            configureBackgroundAudioSession()
            
            // Start background task if needed
            startBackgroundTask()
        }
        
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("SceneDidEnterBackground"),
            object: nil
        )
    }
    
    func sceneWillEnterForeground(_ scene: UIScene) {
        if isMonitoringEnabled {
            // Restore full quality audio configuration
            let result = audioConfig.configureAudioSession()
            switch result {
            case .success:
                resumeAudioMonitoring()
            case .failure(let error):
                handleAudioConfigurationError(error)
            }
        }
        
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("SceneWillEnterForeground"),
            object: nil
        )
    }
    
    // MARK: - Private Methods
    private func configureInitialAudioSession() {
        // Request microphone permission
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            guard let self = self else { return }
            if granted {
                DispatchQueue.main.async {
                    let result = self.audioConfig.configureAudioSession()
                    if case .failure(let error) = result {
                        self.handleAudioConfigurationError(error)
                    }
                }
            } else {
                self.handleMicrophonePermissionDenied()
            }
        }
    }
    
    private func resumeAudioMonitoring() {
        // Ensure audio session is active and configured
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            // Post notification to resume monitoring
            NotificationCenter.default.post(
                name: NSNotification.Name("ResumeAudioMonitoring"),
                object: nil
            )
        } catch {
            handleAudioConfigurationError(error)
        }
    }
    
    private func prepareForBackground() {
        // Optimize audio configuration for background
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord,
                                      mode: .measurement,
                                      options: [.mixWithOthers, .allowBluetooth])
        } catch {
            handleAudioConfigurationError(error)
        }
    }
    
    private func configureBackgroundAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord,
                                      mode: .measurement,
                                      options: [.mixWithOthers, .allowBluetooth])
            try audioSession.setActive(true)
        } catch {
            handleAudioConfigurationError(error)
        }
    }
    
    private func startBackgroundTask() {
        let taskIdentifier = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
        
        if taskIdentifier == .invalid {
            endBackgroundTask()
        }
    }
    
    private func endBackgroundTask() {
        UIApplication.shared.endBackgroundTask(.invalid)
    }
    
    private func handleAudioConfigurationError(_ error: Error) {
        // Log error
        print("Audio configuration error: \(error.localizedDescription)")
        
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("AudioConfigurationError"),
            object: error
        )
        
        // Disable monitoring if critical error
        if case AudioConfigurationError.audioSessionActivationFailed = error {
            isMonitoringEnabled = false
        }
    }
    
    private func handleMicrophonePermissionDenied() {
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("MicrophonePermissionDenied"),
            object: nil
        )
        
        // Disable monitoring
        isMonitoringEnabled = false
    }
}