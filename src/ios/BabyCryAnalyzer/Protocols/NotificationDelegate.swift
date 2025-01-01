import UserNotifications  // iOS 14.0+
import Foundation        // iOS 14.0+

/// Protocol defining comprehensive notification handling requirements for the Baby Cry Analyzer app.
/// Thread-safe protocol for managing notification delivery, failures, user responses, and permissions.
/// - Note: All methods may be called on any thread. Implementers must handle thread switching appropriately.
@objc public protocol NotificationDelegate {
    
    /// Called when a notification is successfully received and processed.
    /// - Parameter notification: The received notification containing cry pattern data
    /// - Important: May be called on any thread. Implementers must dispatch UI updates to main thread.
    /// - Note: Validates notification source and processes attached audio data
    @objc func didReceiveNotification(_ notification: UNNotification)
    
    /// Called when notification delivery or processing fails.
    /// - Parameters:
    ///   - identifier: Unique identifier of the failed notification
    ///   - error: Detailed error information about the failure
    /// - Important: Implementers should log failures and attempt recovery where possible
    /// - Note: May trigger automatic retry based on error type
    @objc func didFailToReceiveNotification(identifier: String, error: Error)
    
    /// Called when user interacts with a notification.
    /// - Parameter response: User's response to the notification including action identifier
    /// - Important: Response processing should be performed on background queue
    /// - Note: Updates cry pattern analysis based on user feedback
    @objc func didRespondToNotification(_ response: UNNotificationResponse)
    
    /// Called when notification permissions are requested or changed.
    /// - Parameters:
    ///   - granted: Boolean indicating if permissions were granted
    ///   - error: Optional error if permission request failed
    /// - Important: Updates app permission state and UI accordingly
    /// - Note: Logs permission changes for analytics
    @objc func didRequestNotificationPermissions(granted: Bool, error: Error?)
}

// MARK: - Default Protocol Implementation
public extension NotificationDelegate {
    
    /// Default thread-safety wrapper for notification receipt
    func didReceiveNotification(_ notification: UNNotification) {
        // Ensure UI updates occur on main thread
        if !Thread.isMainThread {
            DispatchQueue.main.async {
                self.didReceiveNotification(notification)
            }
            return
        }
        
        // Default implementation can be overridden
    }
    
    /// Default error handling implementation
    func didFailToReceiveNotification(identifier: String, error: Error) {
        // Process on background queue to avoid blocking
        DispatchQueue.global(qos: .utility).async {
            // Default implementation can be overridden
        }
    }
    
    /// Default response handling implementation
    func didRespondToNotification(_ response: UNNotificationResponse) {
        // Process on background queue to avoid blocking
        DispatchQueue.global(qos: .utility).async {
            // Default implementation can be overridden
        }
    }
    
    /// Default permission handling implementation
    func didRequestNotificationPermissions(granted: Bool, error: Error?) {
        // Ensure UI updates occur on main thread
        if !Thread.isMainThread {
            DispatchQueue.main.async {
                self.didRequestNotificationPermissions(granted: granted, error: error)
            }
            return
        }
        
        // Default implementation can be overridden
    }
}