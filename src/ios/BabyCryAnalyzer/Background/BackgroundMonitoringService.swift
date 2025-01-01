// Foundation framework - iOS 14.0+
import Foundation
import BackgroundTasks
import UIKit

// MARK: - Constants
private let kBackgroundTaskIdentifier = "com.babycryanalyzer.backgroundMonitoring"
private let kMinimumBackgroundInterval: TimeInterval = 900.0 // 15 minutes
private let kMaxRetryAttempts = 3
private let kBackoffMultiplier: TimeInterval = 1.5
private let kStateStorageKey = "backgroundMonitoringState"
private let kMinimumBatteryLevelForMonitoring: Float = 0.2 // 20%

// MARK: - MonitoringError
public enum MonitoringError: Error {
    case configurationDisabled
    case lowBattery
    case taskRegistrationFailed
    case audioProcessorError
    case quotaExceeded
    case systemError(Error)
}

// MARK: - BackgroundMonitoringService
@objc public class BackgroundMonitoringService: NSObject {
    
    // MARK: - Properties
    private let configuration: BackgroundConfiguration
    private let audioProcessor: AudioProcessor
    public weak var delegate: BackgroundTaskDelegate?
    
    private let taskScheduler = BGTaskScheduler.shared
    private var isMonitoring: Bool = false
    private var retryCount: Int = 0
    private var currentInterval: TimeInterval
    private let stateStorage = UserDefaults.standard
    
    // MARK: - Initialization
    public init(config: BackgroundConfiguration, processor: AudioProcessor) {
        self.configuration = config
        self.audioProcessor = processor
        self.currentInterval = config.monitoringInterval
        
        super.init()
        
        // Register background task
        registerBackgroundTask()
        
        // Restore previous state if available
        restoreState()
        
        // Setup battery monitoring
        setupBatteryMonitoring()
    }
    
    // MARK: - Public Methods
    @objc public func startMonitoring() -> Result<Void, MonitoringError> {
        // Verify configuration is enabled
        guard configuration.isEnabled else {
            return .failure(.configurationDisabled)
        }
        
        // Check battery level
        guard verifyBatteryLevel() else {
            return .failure(.lowBattery)
        }
        
        do {
            // Calculate optimal monitoring interval
            currentInterval = calculateOptimalInterval()
            
            // Schedule initial background task
            try scheduleBackgroundTask()
            
            // Configure audio processor for low power mode
            audioProcessor.setLowPowerMode(true)
            
            // Update monitoring state
            isMonitoring = true
            saveState()
            
            // Notify delegate
            delegate?.backgroundTaskDidStart()
            
            return .success(())
        } catch {
            return .failure(.systemError(error))
        }
    }
    
    @objc public func stopMonitoring() {
        // Cancel all scheduled tasks
        taskScheduler.cancelAllTaskRequests()
        
        // Stop audio processor
        if audioProcessor.isRecording {
            audioProcessor.stopRecording()
        }
        
        // Clear state
        clearState()
        
        // Reset counters
        retryCount = 0
        currentInterval = configuration.monitoringInterval
        
        // Update monitoring state
        isMonitoring = false
        
        // Notify delegate
        delegate?.backgroundTaskDidStop(nil)
    }
    
    // MARK: - Private Methods
    private func registerBackgroundTask() {
        taskScheduler.register(forTaskWithIdentifier: kBackgroundTaskIdentifier, using: nil) { [weak self] task in
            self?.handleBackgroundTask(task)
        }
    }
    
    private func scheduleBackgroundTask() throws {
        let request = BGProcessingTaskRequest(identifier: kBackgroundTaskIdentifier)
        request.requiresNetworkConnectivity = false
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: currentInterval)
        
        do {
            try taskScheduler.submit(request)
        } catch {
            throw MonitoringError.taskRegistrationFailed
        }
    }
    
    private func handleBackgroundTask(_ task: BGTask) {
        // Verify battery level
        guard verifyBatteryLevel() else {
            task.setTaskCompleted(success: false)
            stopMonitoring()
            return
        }
        
        // Schedule next task before processing
        do {
            try scheduleBackgroundTask()
        } catch {
            handleTaskError(error)
            task.setTaskCompleted(success: false)
            return
        }
        
        // Start audio processing
        let processingResult = audioProcessor.startRecording()
        
        switch processingResult {
        case .success:
            // Set expiration handler
            task.expirationHandler = { [weak self] in
                self?.audioProcessor.stopRecording()
                self?.handleTaskExpiration()
            }
            
            // Process for a fixed duration
            DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
                self?.audioProcessor.stopRecording()
                task.setTaskCompleted(success: true)
                self?.retryCount = 0 // Reset retry count on success
            }
            
        case .failure(let error):
            handleTaskError(error)
            task.setTaskCompleted(success: false)
        }
    }
    
    private func calculateOptimalInterval() -> TimeInterval {
        var interval = configuration.monitoringInterval
        
        // Adjust based on battery level
        let batteryLevel = UIDevice.current.batteryLevel
        if batteryLevel < 0.5 { // Below 50%
            interval *= 1.5
        }
        if batteryLevel < 0.3 { // Below 30%
            interval *= 2.0
        }
        
        // Apply retry backoff if needed
        if retryCount > 0 {
            interval *= pow(kBackoffMultiplier, Double(retryCount))
        }
        
        // Ensure minimum interval
        return max(interval, kMinimumBackgroundInterval)
    }
    
    private func verifyBatteryLevel() -> Bool {
        guard configuration.batteryOptimizationEnabled else {
            return true
        }
        
        let currentLevel = UIDevice.current.batteryLevel
        return currentLevel > configuration.minimumBatteryLevel
    }
    
    private func handleTaskError(_ error: Error) {
        retryCount += 1
        
        if retryCount >= kMaxRetryAttempts {
            stopMonitoring()
            delegate?.backgroundTaskDidFail(MonitoringError.quotaExceeded)
        } else {
            currentInterval = calculateOptimalInterval()
            delegate?.backgroundTaskDidFail(MonitoringError.systemError(error))
        }
    }
    
    private func handleTaskExpiration() {
        retryCount += 1
        if retryCount >= kMaxRetryAttempts {
            stopMonitoring()
        }
    }
    
    private func setupBatteryMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleBatteryLevelChange),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
    }
    
    @objc private func handleBatteryLevelChange(_ notification: Notification) {
        if isMonitoring && !verifyBatteryLevel() {
            stopMonitoring()
            delegate?.backgroundTaskDidFail(MonitoringError.lowBattery)
        }
    }
    
    private func saveState() {
        stateStorage.set(isMonitoring, forKey: kStateStorageKey)
        stateStorage.synchronize()
    }
    
    private func restoreState() {
        isMonitoring = stateStorage.bool(forKey: kStateStorageKey)
        if isMonitoring {
            _ = startMonitoring()
        }
    }
    
    private func clearState() {
        stateStorage.removeObject(forKey: kStateStorageKey)
        stateStorage.synchronize()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        stopMonitoring()
    }
}