// XCTest framework - iOS 14.0+
import XCTest
// Foundation framework - iOS 14.0+
import Foundation

/// Comprehensive UI test suite for background monitoring functionality in the Baby Cry Analyzer iOS app.
/// Validates monitoring states, battery optimization, and user interactions with extensive test coverage.
class BackgroundMonitoringUITests: XCTestCase {
    
    // MARK: - Properties
    private var app: XCUIApplication!
    private let defaultTimeout: TimeInterval = 30.0
    private var isMonitoringActive = false
    
    // MARK: - Test Lifecycle
    override func setUp() {
        super.setUp()
        
        // Initialize application
        app = XCUIApplication()
        
        // Configure test environment
        app.launchArguments = ["--uitesting"]
        app.launchEnvironment = [
            "MONITORING_TEST_MODE": "1",
            "BATTERY_SIMULATION_ENABLED": "1"
        ]
        
        // Reset monitoring state
        isMonitoringActive = false
        
        // Launch app for testing
        app.launch()
        
        // Enable system alert handling
        addUIInterruptionMonitor(withDescription: "System Alert") { alert -> Bool in
            // Handle microphone permission alert
            if alert.buttons["OK"].exists {
                alert.buttons["OK"].tap()
                return true
            }
            return false
        }
    }
    
    override func tearDown() {
        // Ensure monitoring is stopped after each test
        if isMonitoringActive {
            stopMonitoring()
        }
        app = nil
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    /// Tests the complete flow of starting background monitoring
    func testStartMonitoring() throws {
        // Navigate to monitoring screen
        let monitoringTab = app.tabBars.buttons["Monitor"]
        XCTAssertTrue(monitoringTab.waitForExistence(timeout: defaultTimeout))
        monitoringTab.tap()
        
        // Verify initial state
        let startButton = app.buttons["StartMonitoringButton"]
        XCTAssertTrue(startButton.waitForExistence(timeout: defaultTimeout))
        XCTAssertTrue(startButton.isEnabled)
        
        // Start monitoring
        startButton.tap()
        
        // Verify monitoring status indicator
        let statusIndicator = app.staticTexts["MonitoringStatusLabel"]
        XCTAssertTrue(statusIndicator.waitForExistence(timeout: defaultTimeout))
        XCTAssertEqual(statusIndicator.label, "Monitoring Active")
        
        // Verify audio processor initialization
        let audioLevelIndicator = app.progressIndicators["AudioLevelIndicator"]
        XCTAssertTrue(audioLevelIndicator.waitForExistence(timeout: defaultTimeout))
        
        // Verify background task scheduling
        let backgroundIndicator = app.images["BackgroundTaskIndicator"]
        XCTAssertTrue(backgroundIndicator.waitForExistence(timeout: defaultTimeout))
        
        isMonitoringActive = true
    }
    
    /// Tests stopping background monitoring and resource cleanup
    func testStopMonitoring() throws {
        // Start monitoring as prerequisite
        try testStartMonitoring()
        
        // Verify active state
        let statusIndicator = app.staticTexts["MonitoringStatusLabel"]
        XCTAssertEqual(statusIndicator.label, "Monitoring Active")
        
        // Stop monitoring
        let stopButton = app.buttons["StopMonitoringButton"]
        XCTAssertTrue(stopButton.waitForExistence(timeout: defaultTimeout))
        stopButton.tap()
        
        // Verify monitoring stopped
        XCTAssertTrue(statusIndicator.waitForExistence(timeout: defaultTimeout))
        XCTAssertEqual(statusIndicator.label, "Monitoring Inactive")
        
        // Verify UI reset
        let startButton = app.buttons["StartMonitoringButton"]
        XCTAssertTrue(startButton.isEnabled)
        
        isMonitoringActive = false
    }
    
    /// Tests battery optimization features and warning system
    func testBatteryLevelWarning() throws {
        // Navigate to monitoring screen
        let monitoringTab = app.tabBars.buttons["Monitor"]
        XCTAssertTrue(monitoringTab.waitForExistence(timeout: defaultTimeout))
        monitoringTab.tap()
        
        // Simulate low battery
        app.launchEnvironment["SIMULATED_BATTERY_LEVEL"] = "0.15" // 15%
        
        // Attempt to start monitoring
        let startButton = app.buttons["StartMonitoringButton"]
        XCTAssertTrue(startButton.waitForExistence(timeout: defaultTimeout))
        startButton.tap()
        
        // Verify warning alert
        let alert = app.alerts["Battery Warning"]
        XCTAssertTrue(alert.waitForExistence(timeout: defaultTimeout))
        
        // Verify alert message
        let alertMessage = alert.staticTexts["Low battery level. Monitoring requires at least 20% battery."]
        XCTAssertTrue(alertMessage.exists)
        
        // Dismiss alert
        alert.buttons["OK"].tap()
        
        // Verify monitoring didn't start
        let statusIndicator = app.staticTexts["MonitoringStatusLabel"]
        XCTAssertEqual(statusIndicator.label, "Monitoring Inactive")
    }
    
    /// Tests monitoring continuity during app state transitions
    func testBackgroundStateTransition() throws {
        // Start monitoring
        try testStartMonitoring()
        
        // Verify active state
        let statusIndicator = app.staticTexts["MonitoringStatusLabel"]
        XCTAssertEqual(statusIndicator.label, "Monitoring Active")
        
        // Transition to background
        XCUIDevice.shared.press(.home)
        
        // Wait for background processing
        Thread.sleep(forTimeInterval: 5.0)
        
        // Return to foreground
        app.activate()
        
        // Verify monitoring continues
        XCTAssertTrue(statusIndicator.waitForExistence(timeout: defaultTimeout))
        XCTAssertEqual(statusIndicator.label, "Monitoring Active")
        
        // Verify audio processing
        let audioLevelIndicator = app.progressIndicators["AudioLevelIndicator"]
        XCTAssertTrue(audioLevelIndicator.exists)
    }
    
    // MARK: - Helper Methods
    
    private func stopMonitoring() {
        if isMonitoringActive {
            let stopButton = app.buttons["StopMonitoringButton"]
            if stopButton.waitForExistence(timeout: defaultTimeout) {
                stopButton.tap()
                isMonitoringActive = false
            }
        }
    }
}