import XCTest          // iOS 14.0+
import UserNotifications  // iOS 14.0+

class NotificationUITests: XCTestCase {
    
    // MARK: - Properties
    private var app: XCUIApplication!
    private var notificationService: NotificationService!
    private let notificationTimeout: TimeInterval = 30
    private let standardTimeout: TimeInterval = 5
    
    // MARK: - Test Lifecycle
    override func setUp() {
        super.setUp()
        
        // Initialize application
        app = XCUIApplication()
        app.launchArguments = ["UI_TESTING"]
        app.launchEnvironment = [
            "NOTIFICATION_TIMEOUT": String(notificationTimeout),
            "DISABLE_ANIMATIONS": "1"
        ]
        
        // Configure notification service
        notificationService = NotificationService.shared
        
        // Reset notification state
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        
        // Launch app
        app.launch()
    }
    
    override func tearDown() {
        app = nil
        notificationService = nil
        super.tearDown()
    }
    
    // MARK: - Permission Tests
    func testNotificationPermissionRequest() throws {
        // Navigate to settings
        let settingsButton = app.buttons["Settings"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: standardTimeout))
        settingsButton.tap()
        
        // Enable notifications
        let notificationsToggle = app.switches["Enable Notifications"]
        XCTAssertTrue(notificationsToggle.waitForExistence(timeout: standardTimeout))
        
        if !notificationsToggle.isEnabled {
            notificationsToggle.tap()
            
            // Verify system permission dialog
            let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            let allowButton = springboard.buttons["Allow"]
            XCTAssertTrue(allowButton.waitForExistence(timeout: standardTimeout))
            allowButton.tap()
        }
        
        // Verify permission granted
        let permissionStatus = app.staticTexts["Permission Status"]
        XCTAssertTrue(permissionStatus.waitForExistence(timeout: standardTimeout))
        XCTAssertEqual(permissionStatus.label, "Notifications Enabled")
    }
    
    // MARK: - Notification Display Tests
    func testNotificationDisplay() throws {
        // Start monitoring
        let monitorButton = app.buttons["Start Monitor"]
        XCTAssertTrue(monitorButton.waitForExistence(timeout: standardTimeout))
        monitorButton.tap()
        
        // Trigger test notification
        let startTime = Date()
        notificationService.scheduleNotification(
            title: "Test Notification",
            body: "Testing notification display",
            type: .cryDetected
        )
        
        // Verify notification appears
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let notification = springboard.otherElements["NotificationShortLookView"]
        XCTAssertTrue(notification.waitForExistence(timeout: notificationTimeout))
        
        // Verify notification content
        XCTAssertTrue(notification.staticTexts["Test Notification"].exists)
        XCTAssertTrue(notification.staticTexts["Testing notification display"].exists)
        
        // Verify delivery time
        let deliveryTime = Date().timeIntervalSince(startTime)
        XCTAssertLessThan(deliveryTime, notificationTimeout)
        
        // Verify accessibility
        XCTAssertTrue(notification.isAccessibilityElement)
        XCTAssertNotNil(notification.identifier)
    }
    
    // MARK: - Notification Action Tests
    func testNotificationActions() throws {
        // Trigger notification with actions
        notificationService.scheduleNotification(
            title: "Action Test",
            body: "Testing notification actions",
            type: .patternRecognized
        )
        
        // Wait for notification
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let notification = springboard.otherElements["NotificationShortLookView"]
        XCTAssertTrue(notification.waitForExistence(timeout: notificationTimeout))
        
        // Verify action buttons
        let respondButton = notification.buttons["Respond"]
        let logButton = notification.buttons["Log Event"]
        let dismissButton = notification.buttons["Dismiss"]
        
        XCTAssertTrue(respondButton.exists)
        XCTAssertTrue(logButton.exists)
        XCTAssertTrue(dismissButton.exists)
        
        // Test respond action
        respondButton.tap()
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: standardTimeout))
        XCTAssertTrue(app.staticTexts["Response Recorded"].exists)
        
        // Test log action
        logButton.tap()
        XCTAssertTrue(app.staticTexts["Event Logged"].exists)
        
        // Test dismiss action
        dismissButton.tap()
        XCTAssertFalse(notification.exists)
    }
    
    // MARK: - Background Notification Tests
    func testBackgroundNotifications() throws {
        // Put app in background
        XCUIDevice.shared.press(.home)
        
        // Schedule background notification
        notificationService.scheduleNotification(
            title: "Background Test",
            body: "Testing background delivery",
            type: .alert
        )
        
        // Verify notification delivery
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let notification = springboard.otherElements["NotificationShortLookView"]
        XCTAssertTrue(notification.waitForExistence(timeout: notificationTimeout))
        
        // Verify content
        XCTAssertTrue(notification.staticTexts["Background Test"].exists)
        
        // Return to app via notification
        notification.tap()
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: standardTimeout))
        
        // Verify app state
        let statusText = app.staticTexts["Notification Status"]
        XCTAssertTrue(statusText.waitForExistence(timeout: standardTimeout))
        XCTAssertEqual(statusText.label, "Background Notification Handled")
    }
    
    // MARK: - Performance Tests
    func testNotificationPerformance() throws {
        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            // Schedule notification
            notificationService.scheduleNotification(
                title: "Performance Test",
                body: "Testing notification performance",
                type: .reminder
            )
            
            // Wait for delivery
            let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            let notification = springboard.otherElements["NotificationShortLookView"]
            XCTAssertTrue(notification.waitForExistence(timeout: notificationTimeout))
        }
    }
    
    // MARK: - Security Tests
    func testNotificationSecurity() throws {
        // Test invalid notification source
        let invalidNotification = UNMutableNotificationContent()
        invalidNotification.title = "Invalid Source"
        invalidNotification.body = "Testing security validation"
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: invalidNotification,
            trigger: nil
        )
        
        // Verify security validation
        let expectation = XCTestExpectation(description: "Security validation")
        UNUserNotificationCenter.current().add(request) { error in
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: standardTimeout)
    }
}