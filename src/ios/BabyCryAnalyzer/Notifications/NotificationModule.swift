import React                // v0.71+
import UserNotifications   // iOS 14.0+
import Foundation         // iOS 14.0+

// MARK: - Constants
private let kModuleName = "NotificationModule"
private let kEventNotificationReceived = "onNotificationReceived"
private let kEventNotificationFailed = "onNotificationFailed"
private let kEventNotificationValidated = "onNotificationValidated"
private let kEventNotificationMetrics = "onNotificationMetrics"
private let kMaxRetryAttempts = 3
private let kNotificationTimeout: TimeInterval = 30.0

// MARK: - NotificationModule
@objc(NotificationModule)
class NotificationModule: RCTEventEmitter {
    
    // MARK: - Properties
    private let notificationService = NotificationService.shared
    private var hasListeners = false
    private let notificationQueue = DispatchQueue(label: "com.babycryanalyzer.notificationmodule", qos: .userInitiated)
    private let notificationLock = NSLock()
    private var retryCount = NSMutableDictionary()
    
    // MARK: - Initialization
    override init() {
        super.init()
        notificationService.delegate = self
        setupSecurityMonitoring()
    }
    
    // MARK: - RCTEventEmitter Override
    override static func moduleName() -> String! {
        return kModuleName
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func startObserving() {
        hasListeners = true
    }
    
    override func stopObserving() {
        hasListeners = false
    }
    
    override func supportedEvents() -> [String]! {
        return [
            kEventNotificationReceived,
            kEventNotificationFailed,
            kEventNotificationValidated,
            kEventNotificationMetrics
        ]
    }
    
    // MARK: - Public Methods
    @objc(requestPermissions:withRejecter:)
    func requestPermissions(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        notificationQueue.async { [weak self] in
            guard let self = self else {
                reject("ERROR", "Module deallocated", nil)
                return
            }
            
            let startTime = Date()
            
            self.notificationService.requestNotificationPermissions { granted, error in
                let elapsedTime = Date().timeIntervalSince(startTime)
                
                if let error = error {
                    reject("PERMISSION_ERROR", error.localizedDescription, error)
                    return
                }
                
                let result: [String: Any] = [
                    "granted": granted,
                    "processingTime": elapsedTime
                ]
                
                resolve(result)
            }
        }
    }
    
    @objc(scheduleNotification:withResolver:withRejecter:)
    func scheduleNotification(
        _ notificationData: NSDictionary,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        notificationQueue.async { [weak self] in
            guard let self = self else {
                reject("ERROR", "Module deallocated", nil)
                return
            }
            
            self.notificationLock.lock()
            defer { self.notificationLock.unlock() }
            
            guard let title = notificationData["title"] as? String,
                  let body = notificationData["body"] as? String,
                  let typeString = notificationData["type"] as? String,
                  let type = self.mapNotificationType(typeString) else {
                reject("INVALID_DATA", "Invalid notification data", nil)
                return
            }
            
            let delay = notificationData["delay"] as? TimeInterval ?? 0
            
            let startTime = Date()
            
            self.notificationService.scheduleNotification(
                title: title,
                body: body,
                type: type,
                delay: delay
            )
            
            let result: [String: Any] = [
                "scheduled": true,
                "timestamp": Date().timeIntervalSince1970,
                "processingTime": Date().timeIntervalSince(startTime)
            ]
            
            resolve(result)
        }
    }
    
    @objc(clearAllNotifications:withRejecter:)
    func clearAllNotifications(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        notificationQueue.async { [weak self] in
            guard let self = self else {
                reject("ERROR", "Module deallocated", nil)
                return
            }
            
            self.notificationLock.lock()
            defer { self.notificationLock.unlock() }
            
            UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            
            resolve(["cleared": true])
        }
    }
    
    // MARK: - Private Methods
    private func setupSecurityMonitoring() {
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Monitor notification delivery performance
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(self.handleMetricsUpdate(_:)),
                name: .didUpdatePerformanceMetrics,
                object: nil
            )
            
            // Monitor security validation results
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(self.handleSecurityValidation(_:)),
                name: .didValidateNotificationContent,
                object: nil
            )
        }
    }
    
    private func mapNotificationType(_ type: String) -> NotificationType? {
        switch type {
        case "cry_detected":
            return .cryDetected
        case "pattern_recognized":
            return .patternRecognized
        case "alert":
            return .alert
        case "reminder":
            return .reminder
        default:
            return nil
        }
    }
    
    @objc private func handleMetricsUpdate(_ notification: Notification) {
        guard hasListeners,
              let metrics = notification.userInfo?["metrics"] as? PerformanceMetrics else {
            return
        }
        
        sendEvent(
            withName: kEventNotificationMetrics,
            body: [
                "deliveryLatency": metrics.deliveryLatency,
                "successRate": metrics.successRate,
                "failureCount": metrics.failureCount,
                "securityValidationTime": metrics.securityValidationTime
            ]
        )
    }
    
    @objc private func handleSecurityValidation(_ notification: Notification) {
        guard hasListeners,
              let validationResult = notification.userInfo?["validationResult"] as? Bool else {
            return
        }
        
        sendEvent(
            withName: kEventNotificationValidated,
            body: ["isValid": validationResult]
        )
    }
}

// MARK: - NotificationDelegate
extension NotificationModule: NotificationDelegate {
    func didReceiveNotification(_ notification: UNNotification) {
        guard hasListeners else { return }
        
        let content = notification.request.content
        sendEvent(
            withName: kEventNotificationReceived,
            body: [
                "id": notification.request.identifier,
                "title": content.title,
                "body": content.body,
                "data": content.userInfo
            ]
        )
    }
    
    func didFailToReceiveNotification(identifier: String, error: Error) {
        guard hasListeners else { return }
        
        sendEvent(
            withName: kEventNotificationFailed,
            body: [
                "id": identifier,
                "error": error.localizedDescription
            ]
        )
    }
    
    func didRequestNotificationPermissions(granted: Bool, error: Error?) {
        // Handle permission updates if needed
    }
}