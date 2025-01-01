//
// AudioCaptureUITests.swift
// BabyCryAnalyzer
//
// UI test suite for verifying audio capture functionality
// XCTest Framework: iOS 14.0+
//

import XCTest

// MARK: - Constants
private let kTestTimeout: TimeInterval = 30.0
private let kRecordingDelay: TimeInterval = 5.0
private let kAudioLevelUpdateInterval: TimeInterval = 0.1
private let kPermissionTimeout: TimeInterval = 10.0
private let kAudioLevelThreshold: Float = 0.1
private let kTestRecordingDuration: TimeInterval = 10.0

final class AudioCaptureUITests: XCTestCase {
    
    // MARK: - Properties
    private var app: XCUIApplication!
    private var isPermissionGranted: Bool = false
    private var lastAudioLevel: Float = 0.0
    
    // MARK: - Setup/Teardown
    override func setUp() {
        super.setUp()
        
        continueAfterFailure = false
        app = XCUIApplication()
        
        // Configure test environment
        app.launchArguments += ["--uitesting"]
        app.launchEnvironment["AUDIO_CAPTURE_TEST_MODE"] = "1"
        
        // Launch app
        app.launch()
        
        // Handle microphone permissions
        handleMicrophonePermissions()
    }
    
    override func tearDown() {
        // Stop recording if active
        if app.buttons["StopRecordingButton"].exists {
            app.buttons["StopRecordingButton"].tap()
            wait(for: recordingStopped())
        }
        
        app.terminate()
        super.tearDown()
    }
    
    // MARK: - Test Cases
    func testStartRecording() throws {
        // Verify initial state
        XCTAssertTrue(app.buttons["StartRecordingButton"].exists)
        XCTAssertFalse(app.buttons["StopRecordingButton"].exists)
        
        // Start recording
        app.buttons["StartRecordingButton"].tap()
        
        // Verify recording state
        let recordingIndicator = app.otherElements["RecordingIndicator"]
        XCTAssertTrue(recordingIndicator.waitForExistence(timeout: kTestTimeout))
        XCTAssertTrue(app.buttons["StopRecordingButton"].exists)
        
        // Verify audio level visualization
        let audioLevelView = app.otherElements["AudioLevelView"]
        XCTAssertTrue(audioLevelView.exists)
        
        // Wait for audio level updates
        let expectation = XCTestExpectation(description: "Audio level updates")
        DispatchQueue.main.asyncAfter(deadline: .now() + kRecordingDelay) {
            XCTAssertGreaterThan(self.lastAudioLevel, kAudioLevelThreshold)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    func testStopRecording() throws {
        // Start recording first
        app.buttons["StartRecordingButton"].tap()
        XCTAssertTrue(app.buttons["StopRecordingButton"].waitForExistence(timeout: kTestTimeout))
        
        // Wait for stable recording
        Thread.sleep(forTimeInterval: kRecordingDelay)
        
        // Stop recording
        app.buttons["StopRecordingButton"].tap()
        
        // Verify stopped state
        XCTAssertTrue(app.buttons["StartRecordingButton"].waitForExistence(timeout: kTestTimeout))
        XCTAssertFalse(app.otherElements["RecordingIndicator"].exists)
        
        // Verify audio level view is hidden
        XCTAssertFalse(app.otherElements["AudioLevelView"].exists)
    }
    
    func testAudioLevelIndicator() throws {
        // Start recording
        app.buttons["StartRecordingButton"].tap()
        
        let audioLevelView = app.otherElements["AudioLevelView"]
        XCTAssertTrue(audioLevelView.waitForExistence(timeout: kTestTimeout))
        
        // Monitor audio level updates
        var levelUpdates = 0
        let expectation = XCTestExpectation(description: "Multiple audio level updates")
        
        Timer.scheduledTimer(withTimeInterval: kAudioLevelUpdateInterval, repeats: true) { timer in
            if audioLevelView.exists {
                levelUpdates += 1
                if levelUpdates >= 10 {
                    timer.invalidate()
                    expectation.fulfill()
                }
            }
        }
        
        wait(for: [expectation], timeout: kTestTimeout)
        XCTAssertGreaterThanOrEqual(levelUpdates, 10)
    }
    
    func testPermissionDenied() throws {
        // Reset permissions
        resetMicrophonePermissions()
        app.terminate()
        app.launch()
        
        // Attempt to start recording
        app.buttons["StartRecordingButton"].tap()
        
        // Verify permission alert
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: kTestTimeout))
        XCTAssertTrue(alert.staticTexts["Microphone Access Required"].exists)
        
        // Verify settings button
        let settingsButton = alert.buttons["Settings"]
        XCTAssertTrue(settingsButton.exists)
        
        // Verify recording doesn't start
        XCTAssertFalse(app.otherElements["RecordingIndicator"].exists)
    }
    
    func testLongRecordingSession() throws {
        // Start recording
        app.buttons["StartRecordingButton"].tap()
        XCTAssertTrue(app.buttons["StopRecordingButton"].waitForExistence(timeout: kTestTimeout))
        
        // Record for extended period
        Thread.sleep(forTimeInterval: kTestRecordingDuration)
        
        // Verify recording remains stable
        XCTAssertTrue(app.otherElements["RecordingIndicator"].exists)
        XCTAssertTrue(app.otherElements["AudioLevelView"].exists)
        
        // Stop recording
        app.buttons["StopRecordingButton"].tap()
        XCTAssertTrue(app.buttons["StartRecordingButton"].waitForExistence(timeout: kTestTimeout))
    }
    
    // MARK: - Helper Methods
    private func handleMicrophonePermissions() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        
        // Wait for permission dialog
        let permissionAlert = springboard.alerts.firstMatch
        if permissionAlert.waitForExistence(timeout: kPermissionTimeout) {
            permissionAlert.buttons["Allow"].tap()
            isPermissionGranted = true
        }
    }
    
    private func resetMicrophonePermissions() {
        if isPermissionGranted {
            let settingsApp = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
            settingsApp.launch()
            
            // Navigate to app privacy settings
            settingsApp.tables.cells["Privacy & Security"].tap()
            settingsApp.tables.cells["Microphone"].tap()
            
            // Reset app permissions
            settingsApp.tables.cells["BabyCryAnalyzer"].tap()
            settingsApp.switches["Microphone Access"].tap()
            
            isPermissionGranted = false
        }
    }
    
    private func wait(for condition: @escaping () -> Bool) {
        let expectation = XCTestExpectation(description: "Condition fulfilled")
        
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            if condition() {
                timer.invalidate()
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    private func recordingStopped() -> () -> Bool {
        return {
            return !self.app.otherElements["RecordingIndicator"].exists &&
                   self.app.buttons["StartRecordingButton"].exists
        }
    }
}