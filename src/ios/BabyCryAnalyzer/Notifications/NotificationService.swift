import UserNotifications  // iOS 14.0+
import Foundation        // iOS 14.0+

// MARK: - Global Constants
private let kNotificationServiceQueue = DispatchQueue(label: "com.babycryanalyzer.notifications", qos: .userInitiated)
private let kMaxRetryAttempts = 3
private let kRetryDelay: TimeInterval = 2.0

// MARK: - Performance Metrics
struct PerformanceMetrics {
    var deliveryLatency: TimeInterval
    var successRate: Double
    var failureCount: Int
    var securityValidationTime: TimeInterval
}

// MARK: - Security Validator
class SecurityValidator {
    func validateNotificationContent(_ content: UNNotificationContent) -> Bool {
        // Implement security validation logic
        return true
    }
    
    func validateNotificationSource(_ source: String) -> Bool {
        // Implement source validation logic
        return true
    }
}

// MARK: - NotificationService
@objc public class NotificationService: NSObject {
    
    // MARK: - Properties
    public static let shared = NotificationService()
    public weak var delegate: NotificationDelegate?
    
    private let configuration: NotificationConfiguration
    private let notificationCenter: UNUserNotificationCenter
    private let notificationLock = NSLock()
    private var metrics = PerformanceMetrics(deliveryLatency: 0, successRate: 100, failureCount: 0, securityValidationTime: 0)
    private let securityValidator = SecurityValidator()
    private var isRegisteredForRemoteNotifications = false
    
    // MARK: - Initialization
    private override init() {
        self.configuration = NotificationConfiguration()
        self.notificationCenter = UNUserNotificationCenter.current()
        
        super.init()
        
        // Configure notification center
        self.notificationCenter.delegate = self
        self.setupNotificationHandling()
    }
    
    // MARK: - Public Methods
    public func requestNotificationPermissions(
        options: UNAuthorizationOptions = [.alert, .sound, .badge],
        completion: @escaping (Bool, Error?) -> Void
    ) {
        let startTime = Date()
        
        kNotificationServiceQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.notificationCenter.requestAuthorization(options: options) { granted, error in
                let validationTime = Date().timeIntervalSince(startTime)
                self.metrics.securityValidationTime = validationTime
                
                if granted {
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                        self.isRegisteredForRemoteNotifications = true
                    }
                }
                
                self.delegate?.didRequestNotificationPermissions(granted: granted, error: error)
                
                DispatchQueue.main.async {
                    completion(granted, error)
                }
            }
        }
    }
    
    public func scheduleNotification(
        title: String,
        body: String,
        type: NotificationType,
        delay: TimeInterval = 0
    ) {
        notificationLock.lock()
        defer { notificationLock.unlock() }
        
        let startTime = Date()
        
        // Create and validate notification content
        let content = configuration.configureNotificationContent(
            title: title,
            body: body,
            type: type,
            priority: .default
        )
        
        guard securityValidator.validateNotificationContent(content) else {
            delegate?.didEncounterSecurityIssue(error: .contentValidationFailed)
            return
        }
        
        // Create trigger
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(0.1, delay),
            repeats: false
        )
        
        // Create request
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )
        
        // Schedule notification with retry mechanism
        scheduleNotificationWithRetry(request, attemptCount: 0, startTime: startTime)
    }
    
    // MARK: - Private Methods
    private func setupNotificationHandling() {
        notificationCenter.setNotificationCategories(configuration.notificationCategories)
    }
    
    private func scheduleNotificationWithRetry(
        _ request: UNNotificationRequest,
        attemptCount: Int,
        startTime: Date
    ) {
        notificationCenter.add(request) { [weak self] error in
            guard let self = self else { return }
            
            if let error = error {
                self.handleNotificationError(error, request: request, attemptCount: attemptCount, startTime: startTime)
            } else {
                self.handleNotificationSuccess(request, startTime: startTime)
            }
        }
    }
    
    private func handleNotificationError(
        _ error: Error,
        request: UNNotificationRequest,
        attemptCount: Int,
        startTime: Date
    ) {
        metrics.failureCount += 1
        metrics.successRate = calculateSuccessRate()
        
        if attemptCount < kMaxRetryAttempts {
            kNotificationServiceQueue.asyncAfter(deadline: .now() + kRetryDelay) { [weak self] in
                guard let self = self else { return }
                self.scheduleNotificationWithRetry(
                    request,
                    attemptCount: attemptCount + 1,
                    startTime: startTime
                )
            }
        } else {
            delegate?.didFailToReceiveNotification(
                identifier: request.identifier,
                error: error
            )
        }
        
        updatePerformanceMetrics()
    }
    
    private func handleNotificationSuccess(
        _ request: UNNotificationRequest,
        startTime: Date
    ) {
        metrics.deliveryLatency = Date().timeIntervalSince(startTime)
        updatePerformanceMetrics()
    }
    
    private func calculateSuccessRate() -> Double {
        let totalAttempts = metrics.failureCount + 1
        return Double(totalAttempts - metrics.failureCount) / Double(totalAttempts) * 100
    }
    
    private func updatePerformanceMetrics() {
        delegate?.didUpdatePerformanceMetrics(metrics)
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension NotificationService: UNUserNotificationCenterDelegate {
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        delegate?.didReceiveNotification(notification)
        completionHandler(configuration.presentationOptions)
    }
    
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        configuration.handleNotificationResponse(response)
        delegate?.didRespondToNotification(response)
        completionHandler()
    }
}

// MARK: - Security Error Types
enum NotificationSecurityError: Error {
    case contentValidationFailed
    case invalidSource
    case unauthorizedAccess
}