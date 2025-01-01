import Foundation  // iOS 14.0+
import AVFoundation  // iOS 14.0+
import UserNotifications  // iOS 14.0+
import BackgroundTasks  // iOS 14.0+

// MARK: - Global Constants
private let kPermissionErrorDomain = "com.babycryanalyzer.permissions"
private let kPermissionRequestTimeout: TimeInterval = 10.0
private let kBackgroundTaskIdentifier = "com.babycryanalyzer.audioprocessing"

// MARK: - Permission Error Type
@frozen
public class PermissionError: Error {
    public let errorDescription: String
    public let errorCode: Int
    public let timestamp: Date
    public let permissionType: String?
    
    init(description: String, code: Int, permissionType: String? = nil) {
        self.errorDescription = description
        self.errorCode = code
        self.timestamp = Date()
        self.permissionType = permissionType
        
        // Log error details for debugging
        #if DEBUG
        print("PermissionError: \(description) (Code: \(code), Type: \(permissionType ?? "unknown"))")
        #endif
    }
    
    public var localizedDescription: String {
        let baseMessage = NSLocalizedString(errorDescription, comment: "")
        return String(format: "%@ (Error %d)", baseMessage, errorCode)
    }
}

// MARK: - Permission Cache
private struct PermissionCache {
    static var microphoneStatus: AVAudioSession.RecordPermission?
    static var notificationStatus: UNAuthorizationStatus?
    static var backgroundProcessingStatus: Bool?
    
    static func clearCache() {
        microphoneStatus = nil
        notificationStatus = nil
        backgroundProcessingStatus = nil
    }
}

// MARK: - Permission Utilities
public final class PermissionUtils {
    
    // MARK: - Microphone Permission
    public static func requestMicrophonePermission(completion: @escaping (Result<Void, PermissionError>) -> Void) {
        let audioSession = AVAudioSession.sharedInstance()
        var timeoutTimer: Timer?
        
        // Set timeout handler
        timeoutTimer = Timer.scheduledTimer(withTimeInterval: kPermissionRequestTimeout, repeats: false) { _ in
            timeoutTimer?.invalidate()
            let error = PermissionError(
                description: "Microphone permission request timed out",
                code: -1001,
                permissionType: "microphone"
            )
            completion(.failure(error))
        }
        
        switch audioSession.recordPermission {
        case .granted:
            timeoutTimer?.invalidate()
            PermissionCache.microphoneStatus = .granted
            completion(.success(()))
            
        case .denied:
            timeoutTimer?.invalidate()
            PermissionCache.microphoneStatus = .denied
            let error = PermissionError(
                description: "Microphone access denied",
                code: -1002,
                permissionType: "microphone"
            )
            completion(.failure(error))
            
        case .undetermined:
            audioSession.requestRecordPermission { granted in
                timeoutTimer?.invalidate()
                DispatchQueue.main.async {
                    if granted {
                        PermissionCache.microphoneStatus = .granted
                        completion(.success(()))
                    } else {
                        PermissionCache.microphoneStatus = .denied
                        let error = PermissionError(
                            description: "Microphone access denied by user",
                            code: -1003,
                            permissionType: "microphone"
                        )
                        completion(.failure(error))
                    }
                }
            }
            
        @unknown default:
            timeoutTimer?.invalidate()
            let error = PermissionError(
                description: "Unknown microphone permission status",
                code: -1004,
                permissionType: "microphone"
            )
            completion(.failure(error))
        }
    }
    
    // MARK: - Notification Permission
    public static func requestNotificationPermission(completion: @escaping (Result<Void, PermissionError>) -> Void) {
        var timeoutTimer: Timer?
        
        timeoutTimer = Timer.scheduledTimer(withTimeInterval: kPermissionRequestTimeout, repeats: false) { _ in
            timeoutTimer?.invalidate()
            let error = PermissionError(
                description: "Notification permission request timed out",
                code: -2001,
                permissionType: "notification"
            )
            completion(.failure(error))
        }
        
        let center = UNUserNotificationCenter.current()
        let options: UNAuthorizationOptions = [.alert, .sound, .badge]
        
        center.requestAuthorization(options: options) { granted, error in
            timeoutTimer?.invalidate()
            
            DispatchQueue.main.async {
                if let error = error {
                    let permError = PermissionError(
                        description: error.localizedDescription,
                        code: -2002,
                        permissionType: "notification"
                    )
                    completion(.failure(permError))
                    return
                }
                
                if granted {
                    PermissionCache.notificationStatus = .authorized
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                    completion(.success(()))
                } else {
                    PermissionCache.notificationStatus = .denied
                    let error = PermissionError(
                        description: "Notification access denied by user",
                        code: -2003,
                        permissionType: "notification"
                    )
                    completion(.failure(error))
                }
            }
        }
    }
    
    // MARK: - Background Processing Permission
    public static func requestBackgroundProcessingPermission(completion: @escaping (Result<Void, PermissionError>) -> Void) {
        guard !kBackgroundTaskIdentifier.isEmpty else {
            let error = PermissionError(
                description: "Invalid background task identifier",
                code: -3001,
                permissionType: "background"
            )
            completion(.failure(error))
            return
        }
        
        BGTaskScheduler.shared.register(forTaskWithIdentifier: kBackgroundTaskIdentifier, using: nil) { task in
            // Handle background task execution
            task.setTaskCompleted(success: true)
        }
        
        // Configure background fetch interval with power optimization
        if #available(iOS 14.0, *) {
            do {
                try BGTaskScheduler.shared.setMinimumFetchInterval(BGTaskScheduler.minimumFetchInterval)
                PermissionCache.backgroundProcessingStatus = true
                completion(.success(()))
            } catch {
                let permError = PermissionError(
                    description: "Failed to configure background processing",
                    code: -3002,
                    permissionType: "background"
                )
                completion(.failure(permError))
            }
        } else {
            let error = PermissionError(
                description: "Background processing not supported on this iOS version",
                code: -3003,
                permissionType: "background"
            )
            completion(.failure(error))
        }
    }
    
    // MARK: - Permission Status Check
    public static func checkMicrophonePermissionStatus() -> AVAudioSession.RecordPermission {
        if let cachedStatus = PermissionCache.microphoneStatus {
            return cachedStatus
        }
        
        let status = AVAudioSession.sharedInstance().recordPermission
        PermissionCache.microphoneStatus = status
        return status
    }
}