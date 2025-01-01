// Foundation framework - iOS 14.0+
import Foundation
import React

// MARK: - Constants
private let kModuleName = "BackgroundTaskModule"
private let kSerialQueue = DispatchQueue(label: "com.babycryanalyzer.background")
private let kErrorDomain = "com.babycryanalyzer.background.error"

// MARK: - BackgroundTaskModule
@objc(BackgroundTaskModule)
public class BackgroundTaskModule: RCTEventEmitter {
    
    // MARK: - Properties
    private let monitoringService: BackgroundMonitoringService
    private let configuration: BackgroundConfiguration
    private let serialQueue: DispatchQueue
    private let configLock: NSLock
    
    // MARK: - Initialization
    override init() {
        self.configuration = BackgroundConfiguration()
        self.serialQueue = kSerialQueue
        self.configLock = NSLock()
        
        // Initialize monitoring service with default configuration
        let audioConfig = AudioConfiguration()
        let audioProcessor = try? AudioProcessor(config: audioConfig)
        self.monitoringService = BackgroundMonitoringService(config: configuration, processor: audioProcessor!)
        
        super.init()
        
        // Set up monitoring service delegate
        monitoringService.delegate = self
        
        // Register for battery notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleBatteryLevelChange),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
        UIDevice.current.isBatteryMonitoringEnabled = true
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - RCTEventEmitter Override
    override public static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override public func supportedEvents() -> [String] {
        return [
            "onMonitoringStateChange",
            "onCryDetected",
            "onBatteryOptimizationChange",
            "onError"
        ]
    }
    
    // MARK: - Public Methods
    @objc(startBackgroundMonitoring:withRejecter:)
    public func startBackgroundMonitoring(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        configLock.lock()
        defer { configLock.unlock() }
        
        guard configuration.isEnabled else {
            reject(
                "CONFIG_DISABLED",
                "Background monitoring is disabled in configuration",
                NSError(domain: kErrorDomain, code: -1)
            )
            return
        }
        
        serialQueue.async { [weak self] in
            guard let self = self else { return }
            
            switch self.monitoringService.startMonitoring() {
            case .success:
                self.sendEvent(withName: "onMonitoringStateChange", body: ["isMonitoring": true])
                resolve(["status": "started"])
                
            case .failure(let error):
                let nsError = NSError(domain: kErrorDomain, code: -2, userInfo: [
                    NSLocalizedDescriptionKey: error.localizedDescription
                ])
                reject("START_FAILED", error.localizedDescription, nsError)
            }
        }
    }
    
    @objc(stopBackgroundMonitoring:withRejecter:)
    public func stopBackgroundMonitoring(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        serialQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.monitoringService.stopMonitoring()
            self.sendEvent(withName: "onMonitoringStateChange", body: ["isMonitoring": false])
            resolve(["status": "stopped"])
        }
    }
    
    @objc(getMonitoringStatus:withRejecter:)
    public func getMonitoringStatus(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        serialQueue.async { [weak self] in
            guard let self = self else { return }
            
            let isMonitoring = self.monitoringService.isMonitoring
            let batteryImpact = self.monitoringService.getCurrentBatteryImpact()
            
            let status: [String: Any] = [
                "isMonitoring": isMonitoring,
                "batteryOptimizationEnabled": self.configuration.batteryOptimizationEnabled,
                "batteryImpact": batteryImpact,
                "monitoringInterval": self.configuration.monitoringInterval,
                "minimumBatteryLevel": self.configuration.minimumBatteryLevel
            ]
            
            resolve(status)
        }
    }
    
    @objc(updateConfiguration:withResolver:withRejecter:)
    public func updateConfiguration(
        _ config: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        configLock.lock()
        defer { configLock.unlock() }
        
        // Extract configuration values
        if let enabled = config["enabled"] as? Bool {
            configuration.setEnabled(enabled)
        }
        
        if let interval = config["monitoringInterval"] as? TimeInterval {
            if case .failure = configuration.setMonitoringInterval(interval) {
                reject(
                    "INVALID_INTERVAL",
                    "Invalid monitoring interval specified",
                    NSError(domain: kErrorDomain, code: -3)
                )
                return
            }
        }
        
        if let batteryOptimization = config["batteryOptimizationEnabled"] as? Bool {
            configuration.setBatteryOptimizationEnabled(batteryOptimization)
        }
        
        if let batteryThreshold = config["minimumBatteryLevel"] as? Double {
            if case .failure = configuration.setBatteryThreshold(batteryThreshold) {
                reject(
                    "INVALID_THRESHOLD",
                    "Invalid battery threshold specified",
                    NSError(domain: kErrorDomain, code: -4)
                )
                return
            }
        }
        
        // Update monitoring service with new configuration
        monitoringService.updateBatteryOptimization()
        
        resolve(["status": "updated"])
    }
    
    // MARK: - Private Methods
    @objc private func handleBatteryLevelChange(_ notification: Notification) {
        let batteryLevel = UIDevice.current.batteryLevel
        if batteryLevel <= configuration.minimumBatteryLevel {
            serialQueue.async { [weak self] in
                guard let self = self else { return }
                if self.monitoringService.isMonitoring {
                    self.monitoringService.stopMonitoring()
                    self.sendEvent(
                        withName: "onError",
                        body: ["code": "LOW_BATTERY", "message": "Monitoring stopped due to low battery"]
                    )
                }
            }
        }
    }
}

// MARK: - BackgroundTaskDelegate
extension BackgroundTaskModule: BackgroundTaskDelegate {
    public func backgroundTaskDidStart() {
        sendEvent(withName: "onMonitoringStateChange", body: ["isMonitoring": true])
    }
    
    public func backgroundTaskDidStop(_ error: Error?) {
        var body: [String: Any] = ["isMonitoring": false]
        if let error = error {
            body["error"] = error.localizedDescription
        }
        sendEvent(withName: "onMonitoringStateChange", body: body)
    }
    
    public func backgroundTaskDidDetectCry(
        _ audioData: Data,
        confidence: Double,
        timestamp: Date,
        metadata: [String: Any]
    ) {
        let eventBody: [String: Any] = [
            "confidence": confidence,
            "timestamp": timestamp.timeIntervalSince1970,
            "metadata": metadata
        ]
        sendEvent(withName: "onCryDetected", body: eventBody)
    }
}