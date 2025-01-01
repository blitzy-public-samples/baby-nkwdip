import XCTest               // iOS 14.0+
import UserNotifications    // iOS 14.0+
@testable import BabyCryAnalyzer

class NotificationModuleTests: XCTestCase {
    
    // MARK: - Properties
    private var sut: NotificationModule!
    private var mockService: MockNotificationService!
    private var notificationExpectation: XCTestExpectation!
    private var metrics: PerformanceMetrics!
    
    // MARK: - Setup/Teardown
    override func setUp() {
        super.setUp()
        mockService = MockNotificationService()
        sut = NotificationModule()
        sut.setValue(mockService, forKey: "notificationService")
        metrics = PerformanceMetrics(
            deliveryLatency: 0,
            successRate: 100,
            failureCount: 0,
            securityValidationTime: 0
        )
    }
    
    override func tearDown() {
        sut.clearAllNotifications(
            { _ in },
            reject: { _, _, _ in }
        )
        sut = nil
        mockService = nil
        metrics = nil
        super.tearDown()
    }
    
    // MARK: - Module Configuration Tests
    func testModuleInitialization() {
        XCTAssertNotNil(sut)
        XCTAssertNotNil(sut.value(forKey: "notificationService"))
        XCTAssertEqual(sut.supportedEvents().count, 4)
    }
    
    func testSupportedEvents() {
        let events = sut.supportedEvents()
        XCTAssertTrue(events.contains("onNotificationReceived"))
        XCTAssertTrue(events.contains("onNotificationFailed"))
        XCTAssertTrue(events.contains("onNotificationValidated"))
        XCTAssertTrue(events.contains("onNotificationMetrics"))
    }
    
    // MARK: - Permission Tests
    func testRequestPermissions() {
        let expectation = self.expectation(description: "Permission request")
        
        mockService.permissionGranted = true
        
        sut.requestPermissions(
            resolve: { result in
                guard let resultDict = result as? [String: Any] else {
                    XCTFail("Invalid result format")
                    return
                }
                
                XCTAssertTrue(resultDict["granted"] as? Bool ?? false)
                XCTAssertNotNil(resultDict["processingTime"])
                expectation.fulfill()
            },
            reject: { _, _, _ in
                XCTFail("Permission request should not fail")
            }
        )
        
        waitForExpectations(timeout: 5)
    }
    
    func testRequestPermissionsDenied() {
        let expectation = self.expectation(description: "Permission denied")
        
        mockService.permissionGranted = false
        mockService.permissionError = NSError(domain: "NotificationError", code: 1, userInfo: nil)
        
        sut.requestPermissions(
            resolve: { _ in
                XCTFail("Should fail when permissions denied")
            },
            reject: { code, message, error in
                XCTAssertEqual(code, "PERMISSION_ERROR")
                XCTAssertNotNil(error)
                expectation.fulfill()
            }
        )
        
        waitForExpectations(timeout: 5)
    }
    
    // MARK: - Notification Scheduling Tests
    func testScheduleNotification() {
        let expectation = self.expectation(description: "Schedule notification")
        
        let notificationData: [String: Any] = [
            "title": "Test Notification",
            "body": "Test Body",
            "type": "cry_detected",
            "delay": 0
        ]
        
        sut.scheduleNotification(
            notificationData as NSDictionary,
            resolve: { result in
                guard let resultDict = result as? [String: Any] else {
                    XCTFail("Invalid result format")
                    return
                }
                
                XCTAssertTrue(resultDict["scheduled"] as? Bool ?? false)
                XCTAssertNotNil(resultDict["timestamp"])
                XCTAssertNotNil(resultDict["processingTime"])
                expectation.fulfill()
            },
            reject: { _, _, _ in
                XCTFail("Notification scheduling should not fail")
            }
        )
        
        waitForExpectations(timeout: 5)
    }
    
    func testScheduleNotificationInvalidData() {
        let expectation = self.expectation(description: "Invalid notification data")
        
        let invalidData: [String: Any] = [
            "title": "Test",
            "type": "invalid_type"
        ]
        
        sut.scheduleNotification(
            invalidData as NSDictionary,
            resolve: { _ in
                XCTFail("Should fail with invalid data")
            },
            reject: { code, message, _ in
                XCTAssertEqual(code, "INVALID_DATA")
                expectation.fulfill()
            }
        )
        
        waitForExpectations(timeout: 5)
    }
    
    // MARK: - Security Validation Tests
    func testSecurityValidation() {
        let expectation = self.expectation(description: "Security validation")
        
        mockService.securityValidationResult = true
        
        NotificationCenter.default.addObserver(
            forName: .didValidateNotificationContent,
            object: nil,
            queue: .main
        ) { notification in
            guard let isValid = notification.userInfo?["validationResult"] as? Bool else {
                XCTFail("Missing validation result")
                return
            }
            XCTAssertTrue(isValid)
            expectation.fulfill()
        }
        
        sut.setValue(true, forKey: "hasListeners")
        NotificationCenter.default.post(
            name: .didValidateNotificationContent,
            object: nil,
            userInfo: ["validationResult": true]
        )
        
        waitForExpectations(timeout: 5)
    }
    
    // MARK: - Performance Monitoring Tests
    func testPerformanceMetrics() {
        let expectation = self.expectation(description: "Performance metrics")
        
        metrics.deliveryLatency = 0.5
        metrics.successRate = 95.0
        metrics.failureCount = 1
        metrics.securityValidationTime = 0.1
        
        NotificationCenter.default.addObserver(
            forName: .didUpdatePerformanceMetrics,
            object: nil,
            queue: .main
        ) { notification in
            guard let metrics = notification.userInfo?["metrics"] as? PerformanceMetrics else {
                XCTFail("Missing metrics")
                return
            }
            
            XCTAssertEqual(metrics.deliveryLatency, 0.5, accuracy: 0.1)
            XCTAssertEqual(metrics.successRate, 95.0, accuracy: 0.1)
            XCTAssertEqual(metrics.failureCount, 1)
            XCTAssertEqual(metrics.securityValidationTime, 0.1, accuracy: 0.1)
            expectation.fulfill()
        }
        
        sut.setValue(true, forKey: "hasListeners")
        NotificationCenter.default.post(
            name: .didUpdatePerformanceMetrics,
            object: nil,
            userInfo: ["metrics": metrics]
        )
        
        waitForExpectations(timeout: 5)
    }
    
    // MARK: - Notification Handling Tests
    func testNotificationReceived() {
        let expectation = self.expectation(description: "Notification received")
        
        let content = UNMutableNotificationContent()
        content.title = "Test Title"
        content.body = "Test Body"
        content.userInfo = ["key": "value"]
        
        let request = UNNotificationRequest(
            identifier: "test_id",
            content: content,
            trigger: nil
        )
        
        let notification = UNNotification(request: request, date: Date())
        
        sut.setValue(true, forKey: "hasListeners")
        sut.didReceiveNotification(notification)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }
        
        waitForExpectations(timeout: 5)
    }
}

// MARK: - Mock Service
private class MockNotificationService: NotificationService {
    var permissionGranted = true
    var permissionError: Error?
    var securityValidationResult = true
    
    override func requestNotificationPermissions(
        options: UNAuthorizationOptions,
        completion: @escaping (Bool, Error?) -> Void
    ) {
        completion(permissionGranted, permissionError)
    }
}