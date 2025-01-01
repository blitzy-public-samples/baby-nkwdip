import UserNotifications  // iOS 14.0+
import Foundation        // iOS 14.0+

// MARK: - Global Constants
private let kDefaultNotificationSound = "default"
private let kNotificationCategoryIdentifier = "com.babycryanalyzer.notification"
private let kMaxNotificationBadgeCount = 99
private let kNotificationThreadIdentifier = "com.babycryanalyzer.notifications.thread"
private let kNotificationGroupIdentifier = "com.babycryanalyzer.notifications.group"

// MARK: - Enums
enum NotificationType {
    case cryDetected
    case patternRecognized
    case alert
    case reminder
}

enum NotificationPriority: Int {
    case low = 0
    case default = 5
    case high = 10
}

enum NotificationGroupingStrategy {
    case byType
    case byTime
    case byBaby
    case none
}

enum NotificationError: Error {
    case invalidSettings
    case permissionDenied
    case systemError
}

// MARK: - NotificationConfiguration Class
@objc public class NotificationConfiguration: NSObject {
    
    // MARK: - Properties
    public private(set) var isNotificationsEnabled: Bool
    public private(set) var isSoundEnabled: Bool
    public private(set) var isBadgingEnabled: Bool
    public private(set) var isGroupingEnabled: Bool
    public private(set) var presentationOptions: UNNotificationPresentationOptions
    public private(set) var notificationCategories: Set<UNNotificationCategory>
    public private(set) var currentBadgeCount: Int
    public private(set) var groupingStrategy: NotificationGroupingStrategy
    
    private let notificationCenter = UNUserNotificationCenter.current()
    
    // MARK: - Initialization
    override public init() {
        // Initialize default values
        self.isNotificationsEnabled = true
        self.isSoundEnabled = true
        self.isBadgingEnabled = true
        self.isGroupingEnabled = true
        self.currentBadgeCount = 0
        self.groupingStrategy = .byType
        
        // Configure default presentation options for iOS 14+
        self.presentationOptions = [
            .banner,
            .sound,
            .badge,
            .list
        ]
        
        // Initialize categories
        self.notificationCategories = Set<UNNotificationCategory>()
        
        super.init()
        
        // Configure initial setup
        self.loadSavedPreferences()
        self.notificationCategories = self.configureNotificationCategories()
        self.requestNotificationPermissions()
    }
    
    // MARK: - Public Methods
    public func configureNotificationContent(
        title: String,
        body: String,
        type: NotificationType,
        priority: NotificationPriority
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        
        // Configure basic content
        content.title = NSLocalizedString(title, comment: "")
        content.body = NSLocalizedString(body, comment: "")
        
        // Configure sound
        if isSoundEnabled {
            content.sound = priority == .high ? 
                UNNotificationSound.criticalSoundNamed(UNNotificationSoundName(kDefaultNotificationSound)) :
                UNNotificationSound.default
        }
        
        // Configure badge
        if isBadgingEnabled {
            currentBadgeCount = min(currentBadgeCount + 1, kMaxNotificationBadgeCount)
            content.badge = NSNumber(value: currentBadgeCount)
        }
        
        // Configure category and threading
        content.categoryIdentifier = kNotificationCategoryIdentifier
        content.threadIdentifier = kNotificationThreadIdentifier
        
        // Apply grouping strategy
        if isGroupingEnabled {
            switch groupingStrategy {
            case .byType:
                content.summaryArgument = type.description
            case .byTime:
                content.summaryArgument = DateFormatter.localizedString(from: Date(), dateStyle: .short, timeStyle: .short)
            case .byBaby:
                content.summaryArgument = UserDefaults.standard.string(forKey: "selectedBabyName") ?? "Baby"
            case .none:
                break
            }
        }
        
        // Configure priority and relevance
        content.relevanceScore = Float(priority.rawValue) / 10.0
        
        // Add custom data
        content.userInfo = [
            "type": type.rawValue,
            "priority": priority.rawValue,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        return content
    }
    
    public func updateNotificationSettings(_ settings: NotificationSettings) -> Result<Void, NotificationError> {
        // Validate settings
        guard settings.isValid else {
            return .failure(.invalidSettings)
        }
        
        // Update settings
        self.isNotificationsEnabled = settings.isEnabled
        self.isSoundEnabled = settings.isSoundEnabled
        self.isBadgingEnabled = settings.isBadgingEnabled
        self.isGroupingEnabled = settings.isGroupingEnabled
        self.groupingStrategy = settings.groupingStrategy
        
        // Update presentation options
        var newOptions: UNNotificationPresentationOptions = [.banner, .list]
        if isSoundEnabled { newOptions.insert(.sound) }
        if isBadgingEnabled { newOptions.insert(.badge) }
        self.presentationOptions = newOptions
        
        // Save preferences
        self.savePreferences()
        
        // Update notification center
        self.notificationCenter.setNotificationCategories(self.notificationCategories)
        
        return .success(())
    }
    
    public func configureNotificationCategories() -> Set<UNNotificationCategory> {
        // Configure actions
        let respondAction = UNNotificationAction(
            identifier: "RESPOND_ACTION",
            title: NSLocalizedString("Respond", comment: ""),
            options: [.foreground]
        )
        
        let dismissAction = UNNotificationAction(
            identifier: "DISMISS_ACTION",
            title: NSLocalizedString("Dismiss", comment: ""),
            options: [.destructive]
        )
        
        let logAction = UNNotificationAction(
            identifier: "LOG_ACTION",
            title: NSLocalizedString("Log Event", comment: ""),
            options: []
        )
        
        // Create category
        let category = UNNotificationCategory(
            identifier: kNotificationCategoryIdentifier,
            actions: [respondAction, logAction, dismissAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: NSLocalizedString("New Baby Alert", comment: ""),
            categorySummaryFormat: NSLocalizedString("%@ Notifications", comment: ""),
            options: [.customDismissAction, .allowAnnouncement]
        )
        
        return Set([category])
    }
    
    public func handleNotificationResponse(_ response: UNNotificationResponse) {
        let actionIdentifier = response.actionIdentifier
        let notification = response.notification
        let userInfo = notification.request.content.userInfo
        
        switch actionIdentifier {
        case "RESPOND_ACTION":
            handleRespondAction(userInfo)
        case "LOG_ACTION":
            handleLogAction(userInfo)
        case "DISMISS_ACTION":
            handleDismissAction(userInfo)
        case UNNotificationDefaultActionIdentifier:
            handleDefaultAction(userInfo)
        default:
            break
        }
        
        // Update badge count
        if isBadgingEnabled {
            currentBadgeCount = max(0, currentBadgeCount - 1)
            UNUserNotificationCenter.current().setBadgeCount(currentBadgeCount)
        }
    }
    
    // MARK: - Private Methods
    private func loadSavedPreferences() {
        let defaults = UserDefaults.standard
        isNotificationsEnabled = defaults.bool(forKey: "notificationsEnabled")
        isSoundEnabled = defaults.bool(forKey: "soundEnabled")
        isBadgingEnabled = defaults.bool(forKey: "badgingEnabled")
        isGroupingEnabled = defaults.bool(forKey: "groupingEnabled")
        groupingStrategy = NotificationGroupingStrategy(rawValue: defaults.integer(forKey: "groupingStrategy")) ?? .byType
    }
    
    private func savePreferences() {
        let defaults = UserDefaults.standard
        defaults.set(isNotificationsEnabled, forKey: "notificationsEnabled")
        defaults.set(isSoundEnabled, forKey: "soundEnabled")
        defaults.set(isBadgingEnabled, forKey: "badgingEnabled")
        defaults.set(isGroupingEnabled, forKey: "groupingEnabled")
        defaults.set(groupingStrategy.rawValue, forKey: "groupingStrategy")
        defaults.synchronize()
    }
    
    private func requestNotificationPermissions() {
        notificationCenter.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                self.notificationCenter.setNotificationCategories(self.notificationCategories)
            }
        }
    }
    
    private func handleRespondAction(_ userInfo: [AnyHashable: Any]) {
        // Implementation for respond action
        NotificationCenter.default.post(name: .didRespondToNotification, object: nil, userInfo: userInfo)
    }
    
    private func handleLogAction(_ userInfo: [AnyHashable: Any]) {
        // Implementation for log action
        NotificationCenter.default.post(name: .didLogNotification, object: nil, userInfo: userInfo)
    }
    
    private func handleDismissAction(_ userInfo: [AnyHashable: Any]) {
        // Implementation for dismiss action
        NotificationCenter.default.post(name: .didDismissNotification, object: nil, userInfo: userInfo)
    }
    
    private func handleDefaultAction(_ userInfo: [AnyHashable: Any]) {
        // Implementation for default action
        NotificationCenter.default.post(name: .didTapNotification, object: nil, userInfo: userInfo)
    }
}

// MARK: - Supporting Types
struct NotificationSettings {
    let isEnabled: Bool
    let isSoundEnabled: Bool
    let isBadgingEnabled: Bool
    let isGroupingEnabled: Bool
    let groupingStrategy: NotificationGroupingStrategy
    
    var isValid: Bool {
        return true // Add validation logic if needed
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let didRespondToNotification = Notification.Name("didRespondToNotification")
    static let didLogNotification = Notification.Name("didLogNotification")
    static let didDismissNotification = Notification.Name("didDismissNotification")
    static let didTapNotification = Notification.Name("didTapNotification")
}

// MARK: - NotificationType Extensions
extension NotificationType: CustomStringConvertible {
    var description: String {
        switch self {
        case .cryDetected: return NSLocalizedString("Cry Detection", comment: "")
        case .patternRecognized: return NSLocalizedString("Pattern Recognition", comment: "")
        case .alert: return NSLocalizedString("Alert", comment: "")
        case .reminder: return NSLocalizedString("Reminder", comment: "")
        }
    }
    
    var rawValue: String {
        switch self {
        case .cryDetected: return "cry_detected"
        case .patternRecognized: return "pattern_recognized"
        case .alert: return "alert"
        case .reminder: return "reminder"
        }
    }
}