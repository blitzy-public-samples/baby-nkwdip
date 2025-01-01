// XCTest framework - iOS 14.0+
import XCTest
@testable import BabyCryAnalyzer

// MARK: - Constants
private let kTestTimeout: TimeInterval = 5.0
private let kLowBatteryThreshold: Float = 0.2
private let kMemoryWarningThreshold: Float = 0.8
private let kTestMonitoringInterval: TimeInterval = 300.0 // 5 minutes

class BackgroundTaskModuleTests: XCTestCase {
    
    // MARK: - Properties
    private var sut: BackgroundTaskModule!
    private var mockMonitoringService: MockBackgroundMonitoringService!
    private var mockConfiguration: BackgroundConfiguration!
    private var testQueue: DispatchQueue!
    
    // MARK: - Setup/Teardown
    override func setUp() {
        super.setUp()
        
        // Initialize mock configuration
        mockConfiguration = BackgroundConfiguration()
        mockConfiguration.setEnabled(true)
        _ = mockConfiguration.setMonitoringInterval(kTestMonitoringInterval)
        mockConfiguration.setBatteryOptimizationEnabled(true)
        _ = mockConfiguration.setBatteryThreshold(Double(kLowBatteryThreshold))
        
        // Initialize mock monitoring service
        mockMonitoringService = MockBackgroundMonitoringService(config: mockConfiguration)
        
        // Initialize system under test
        sut = BackgroundTaskModule()
        sut.monitoringService = mockMonitoringService
        
        // Initialize test queue
        testQueue = DispatchQueue(label: "com.babycryanalyzer.tests", qos: .userInitiated)
    }
    
    override func tearDown() {
        sut = nil
        mockMonitoringService = nil
        mockConfiguration = nil
        testQueue = nil
        super.tearDown()
    }
    
    // MARK: - Initialization Tests
    func testInit_ShouldConfigureCorrectly() {
        XCTAssertNotNil(sut)
        XCTAssertNotNil(sut.monitoringService)
        XCTAssertFalse(mockMonitoringService.isMonitoring)
    }
    
    // MARK: - Start Monitoring Tests
    func testStartMonitoring_WhenEnabled_ShouldStartSuccessfully() {
        let expectation = XCTestExpectation(description: "Start monitoring")
        
        sut.startBackgroundMonitoring({ result in
            guard let status = result as? [String: String],
                  status["status"] == "started" else {
                XCTFail("Invalid start monitoring response")
                return
            }
            XCTAssertTrue(self.mockMonitoringService.isMonitoring)
            expectation.fulfill()
        }, rejecter: { _, _, _ in
            XCTFail("Should not reject when enabled")
        })
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    func testStartMonitoring_WhenDisabled_ShouldRejectWithError() {
        mockConfiguration.setEnabled(false)
        
        let expectation = XCTestExpectation(description: "Reject monitoring")
        
        sut.startBackgroundMonitoring({ _ in
            XCTFail("Should not resolve when disabled")
        }, rejecter: { code, message, _ in
            XCTAssertEqual(code, "CONFIG_DISABLED")
            XCTAssertFalse(self.mockMonitoringService.isMonitoring)
            expectation.fulfill()
        })
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    // MARK: - Stop Monitoring Tests
    func testStopMonitoring_WhenMonitoring_ShouldStopSuccessfully() {
        // Start monitoring first
        mockMonitoringService.isMonitoring = true
        
        let expectation = XCTestExpectation(description: "Stop monitoring")
        
        sut.stopBackgroundMonitoring({ result in
            guard let status = result as? [String: String],
                  status["status"] == "stopped" else {
                XCTFail("Invalid stop monitoring response")
                return
            }
            XCTAssertFalse(self.mockMonitoringService.isMonitoring)
            expectation.fulfill()
        }, rejecter: { _, _, _ in
            XCTFail("Should not reject stop monitoring")
        })
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    // MARK: - Battery Optimization Tests
    func testBatteryOptimization_WhenLowBattery_ShouldAdjustMonitoring() {
        let expectation = XCTestExpectation(description: "Battery optimization")
        
        // Simulate low battery
        UIDevice.current.batteryLevel = kLowBatteryThreshold - 0.1
        
        sut.startBackgroundMonitoring({ _ in
            // Verify monitoring was stopped due to low battery
            XCTAssertFalse(self.mockMonitoringService.isMonitoring)
            
            // Verify error event was emitted
            let events = self.sut.supportedEvents()
            XCTAssertTrue(events.contains("onError"))
            
            expectation.fulfill()
        }, rejecter: { _, _, _ in
            XCTFail("Should not reject on low battery")
        })
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    // MARK: - Configuration Update Tests
    func testUpdateConfiguration_WithValidConfig_ShouldUpdateSuccessfully() {
        let expectation = XCTestExpectation(description: "Update configuration")
        
        let newConfig: [String: Any] = [
            "enabled": true,
            "monitoringInterval": 600.0,
            "batteryOptimizationEnabled": true,
            "minimumBatteryLevel": 0.3
        ]
        
        sut.updateConfiguration(newConfig as NSDictionary, resolver: { result in
            guard let status = result as? [String: String],
                  status["status"] == "updated" else {
                XCTFail("Invalid configuration update response")
                return
            }
            
            // Verify configuration was updated
            XCTAssertEqual(self.mockConfiguration.monitoringInterval, 600.0)
            XCTAssertTrue(self.mockConfiguration.batteryOptimizationEnabled)
            
            expectation.fulfill()
        }, rejecter: { _, _, _ in
            XCTFail("Should not reject valid configuration")
        })
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
    
    // MARK: - Thread Safety Tests
    func testThreadSafety_UnderConcurrentAccess_ShouldMaintainConsistency() {
        let startExpectation = XCTestExpectation(description: "Concurrent operations")
        startExpectation.expectedFulfillmentCount = 5
        
        // Perform multiple concurrent operations
        for _ in 0..<5 {
            testQueue.async {
                self.sut.startBackgroundMonitoring({ _ in
                    startExpectation.fulfill()
                }, rejecter: { _, _, _ in
                    XCTFail("Should handle concurrent access")
                })
            }
        }
        
        wait(for: [startExpectation], timeout: kTestTimeout)
        
        // Verify state consistency
        XCTAssertEqual(mockMonitoringService.startCount, 5)
        XCTAssertTrue(mockMonitoringService.isMonitoring)
    }
    
    // MARK: - Memory Warning Tests
    func testMemoryWarning_ShouldHandleGracefully() {
        let expectation = XCTestExpectation(description: "Memory warning")
        
        // Start monitoring
        mockMonitoringService.isMonitoring = true
        
        // Simulate memory warning
        NotificationCenter.default.post(name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
        
        // Verify monitoring continues but optimizes resources
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            XCTAssertTrue(self.mockMonitoringService.isMonitoring)
            XCTAssertTrue(self.mockMonitoringService.isOptimized)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: kTestTimeout)
    }
}

// MARK: - Mock Background Monitoring Service
private class MockBackgroundMonitoringService: BackgroundMonitoringService {
    private(set) var startCount: Int = 0
    private(set) var isOptimized: Bool = false
    
    override func startMonitoring() -> Result<Void, MonitoringError> {
        startCount += 1
        isMonitoring = true
        return .success(())
    }
    
    override func stopMonitoring() {
        isMonitoring = false
    }
    
    func optimizeForMemoryWarning() {
        isOptimized = true
    }
}