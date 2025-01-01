// Foundation framework - iOS 14.0+
import Foundation

// MARK: - Constants
private let kDefaultMonitoringInterval: TimeInterval = 300.0  // 5 minutes
private let kMinimumMonitoringInterval: TimeInterval = 60.0   // 1 minute
private let kMaximumMonitoringInterval: TimeInterval = 900.0  // 15 minutes
private let kDefaultBatteryThreshold: Double = 0.2           // 20%

// MARK: - Configuration Error
enum ConfigurationError: Error {
    case invalidMonitoringInterval
    case invalidBatteryThreshold
}

// MARK: - Notification Names
extension Notification.Name {
    static let backgroundConfigurationDidChange = Notification.Name("backgroundConfigurationDidChange")
}

// MARK: - BackgroundConfiguration
@objc public class BackgroundConfiguration: NSObject, NSCopying {
    
    // MARK: - Properties
    private let _queue: DispatchQueue
    
    @objc public private(set) var isEnabled: Bool {
        didSet {
            NotificationCenter.default.post(name: .backgroundConfigurationDidChange, object: self)
        }
    }
    
    @objc public private(set) var monitoringInterval: TimeInterval {
        didSet {
            NotificationCenter.default.post(name: .backgroundConfigurationDidChange, object: self)
        }
    }
    
    @objc public private(set) var batteryOptimizationEnabled: Bool {
        didSet {
            NotificationCenter.default.post(name: .backgroundConfigurationDidChange, object: self)
        }
    }
    
    @objc public private(set) var minimumBatteryLevel: Double {
        didSet {
            NotificationCenter.default.post(name: .backgroundConfigurationDidChange, object: self)
        }
    }
    
    @objc public private(set) var allowsCellularData: Bool {
        didSet {
            NotificationCenter.default.post(name: .backgroundConfigurationDidChange, object: self)
        }
    }
    
    // MARK: - Initialization
    public override init() {
        _queue = DispatchQueue(label: "com.babycryanalyzer.backgroundconfig", qos: .userInitiated)
        isEnabled = false
        monitoringInterval = kDefaultMonitoringInterval
        batteryOptimizationEnabled = true
        minimumBatteryLevel = kDefaultBatteryThreshold
        allowsCellularData = false
        
        super.init()
        
        // Register for battery level notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleBatteryLevelChange(_:)),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
        UIDevice.current.isBatteryMonitoringEnabled = true
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Public Methods
    @objc public func setMonitoringInterval(_ interval: TimeInterval) -> Result<Void, ConfigurationError> {
        return _queue.sync {
            guard interval >= kMinimumMonitoringInterval && interval <= kMaximumMonitoringInterval else {
                return .failure(.invalidMonitoringInterval)
            }
            
            monitoringInterval = interval
            return .success(())
        }
    }
    
    @objc public func setBatteryThreshold(_ threshold: Double) -> Result<Void, ConfigurationError> {
        return _queue.sync {
            guard threshold >= 0.0 && threshold <= 1.0 else {
                return .failure(.invalidBatteryThreshold)
            }
            
            minimumBatteryLevel = threshold
            updateMonitoringStateForBatteryLevel()
            return .success(())
        }
    }
    
    @objc public func setEnabled(_ enabled: Bool) {
        _queue.sync {
            isEnabled = enabled
            if enabled {
                updateMonitoringStateForBatteryLevel()
            }
        }
    }
    
    @objc public func setAllowsCellularData(_ allowed: Bool) {
        _queue.sync {
            allowsCellularData = allowed
        }
    }
    
    @objc public func setBatteryOptimizationEnabled(_ enabled: Bool) {
        _queue.sync {
            batteryOptimizationEnabled = enabled
            if enabled {
                updateMonitoringStateForBatteryLevel()
            }
        }
    }
    
    // MARK: - NSCopying
    public func copy(with zone: NSZone? = nil) -> Any {
        return _queue.sync {
            let copy = BackgroundConfiguration()
            copy.setEnabled(isEnabled)
            _ = copy.setMonitoringInterval(monitoringInterval)
            copy.setBatteryOptimizationEnabled(batteryOptimizationEnabled)
            _ = copy.setBatteryThreshold(minimumBatteryLevel)
            copy.setAllowsCellularData(allowsCellularData)
            return copy
        }
    }
    
    // MARK: - Private Methods
    @objc private func handleBatteryLevelChange(_ notification: Notification) {
        _queue.async {
            self.updateMonitoringStateForBatteryLevel()
        }
    }
    
    private func updateMonitoringStateForBatteryLevel() {
        guard batteryOptimizationEnabled else { return }
        
        let currentBatteryLevel = UIDevice.current.batteryLevel
        if currentBatteryLevel < minimumBatteryLevel {
            isEnabled = false
        }
    }
}