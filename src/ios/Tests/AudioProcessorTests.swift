//
// AudioProcessorTests.swift
// BabyCryAnalyzer
//
// Comprehensive test suite for AudioProcessor functionality
// XCTest: iOS 14.0+
// AVFoundation: iOS 14.0+
//

import XCTest
import AVFoundation
@testable import BabyCryAnalyzer

// MARK: - Test Constants
private let testSampleRate: Double = 44100.0
private let testBufferSize: Int = 4096
private let testNoiseThreshold: Double = -50.0
private let testCryDetectionThreshold: Double = 0.85
private let testTimeout: TimeInterval = 5.0
private let testAudioFixturePath = "TestResources/test_cry_patterns.wav"

// MARK: - Mock Audio Processor Delegate
class MockAudioProcessorDelegate: NSObject, AudioProcessorDelegate {
    var didStartRecording = false
    var didStopRecording = false
    var lastAudioLevel: Float = 0.0
    var lastDetectedPattern: String?
    var lastConfidence: Float = 0.0
    var lastError: Error?
    
    let recordingExpectation: XCTestExpectation
    let detectionExpectation: XCTestExpectation
    
    init(recordingExpectation: XCTestExpectation, detectionExpectation: XCTestExpectation) {
        self.recordingExpectation = recordingExpectation
        self.detectionExpectation = detectionExpectation
        super.init()
    }
    
    func audioProcessorDidStartRecording() {
        didStartRecording = true
        recordingExpectation.fulfill()
    }
    
    func audioProcessorDidStopRecording() {
        didStopRecording = true
        recordingExpectation.fulfill()
    }
    
    func audioProcessor(didDetectAudioLevel audioLevel: Float) {
        lastAudioLevel = audioLevel
    }
    
    func audioProcessorDidDetectCry(patternType: String, confidence: Float) {
        lastDetectedPattern = patternType
        lastConfidence = confidence
        detectionExpectation.fulfill()
    }
    
    func audioProcessorDidEncounterError(_ error: Error) {
        lastError = error
    }
}

// MARK: - Audio Processor Tests
class AudioProcessorTests: XCTestCase {
    
    private var sut: AudioProcessor!
    private var config: AudioConfiguration!
    private var mockDelegate: MockAudioProcessorDelegate!
    private var recordingExpectation: XCTestExpectation!
    private var detectionExpectation: XCTestExpectation!
    private var testQueue: DispatchQueue!
    
    // MARK: - Setup and Teardown
    override func setUp() {
        super.setUp()
        
        // Initialize test configuration
        config = AudioConfiguration(
            sampleRate: testSampleRate,
            bufferSize: testBufferSize,
            noiseThreshold: testNoiseThreshold,
            cryDetectionThreshold: testCryDetectionThreshold
        )
        
        // Create expectations
        recordingExpectation = expectation(description: "Recording state change")
        detectionExpectation = expectation(description: "Cry pattern detection")
        
        // Initialize mock delegate
        mockDelegate = MockAudioProcessorDelegate(
            recordingExpectation: recordingExpectation,
            detectionExpectation: detectionExpectation
        )
        
        // Initialize audio processor
        do {
            sut = try AudioProcessor(config: config)
            sut.delegate = mockDelegate
        } catch {
            XCTFail("Failed to initialize AudioProcessor: \(error)")
        }
        
        // Setup test queue
        testQueue = DispatchQueue(label: "com.babycryanalyzer.tests", qos: .userInitiated)
    }
    
    override func tearDown() {
        // Stop recording if active
        if sut.isRecording {
            sut.stopRecording()
        }
        
        // Wait for processing queue to empty
        testQueue.sync { }
        
        // Cleanup resources
        sut = nil
        config = nil
        mockDelegate = nil
        recordingExpectation = nil
        detectionExpectation = nil
        testQueue = nil
        
        super.tearDown()
    }
    
    // MARK: - Initialization Tests
    func testInitialization() {
        XCTAssertNotNil(sut, "AudioProcessor should be initialized")
        XCTAssertNotNil(sut.delegate, "Delegate should be set")
        XCTAssertFalse(sut.isRecording, "Should not be recording initially")
    }
    
    func testInitializationWithInvalidConfiguration() {
        let invalidConfig = AudioConfiguration(sampleRate: -1)
        XCTAssertThrowsError(try AudioProcessor(config: invalidConfig)) { error in
            XCTAssertEqual(error as? AudioProcessorError, .invalidConfiguration)
        }
    }
    
    // MARK: - Recording Tests
    func testStartRecording() {
        let result = sut.startRecording()
        
        switch result {
        case .success:
            XCTAssertTrue(sut.isRecording, "Should be recording")
            wait(for: [recordingExpectation], timeout: testTimeout)
            XCTAssertTrue(mockDelegate.didStartRecording, "Delegate should be notified")
        case .failure(let error):
            XCTFail("Failed to start recording: \(error)")
        }
    }
    
    func testStopRecording() {
        // Start recording first
        _ = sut.startRecording()
        wait(for: [recordingExpectation], timeout: testTimeout)
        
        // Reset expectation for stop
        recordingExpectation = expectation(description: "Recording stopped")
        mockDelegate.recordingExpectation = recordingExpectation
        
        sut.stopRecording()
        
        wait(for: [recordingExpectation], timeout: testTimeout)
        XCTAssertFalse(sut.isRecording, "Should not be recording")
        XCTAssertTrue(mockDelegate.didStopRecording, "Delegate should be notified")
    }
    
    // MARK: - Audio Processing Tests
    func testAudioLevelDetection() {
        let audioLevelExpectation = expectation(description: "Audio level detected")
        audioLevelExpectation.assertForOverFulfill = false
        
        _ = sut.startRecording()
        
        // Wait for audio level updates
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            XCTAssertGreaterThan(self.mockDelegate.lastAudioLevel, 0.0)
            audioLevelExpectation.fulfill()
        }
        
        wait(for: [audioLevelExpectation], timeout: testTimeout)
    }
    
    func testCryPatternDetection() {
        detectionExpectation.assertForOverFulfill = false
        
        _ = sut.startRecording()
        
        // Simulate audio input with cry pattern
        injectTestAudioData()
        
        wait(for: [detectionExpectation], timeout: testTimeout)
        XCTAssertEqual(mockDelegate.lastDetectedPattern, "infant_cry")
        XCTAssertGreaterThanOrEqual(mockDelegate.lastConfidence, testCryDetectionThreshold)
    }
    
    // MARK: - Error Handling Tests
    func testRecordingWhileAlreadyRecording() {
        _ = sut.startRecording()
        let result = sut.startRecording()
        
        if case .failure(let error) = result {
            XCTAssertEqual(error, AudioProcessorError.alreadyRecording)
        } else {
            XCTFail("Should fail when starting recording while already recording")
        }
    }
    
    func testAudioSessionInterruption() {
        _ = sut.startRecording()
        
        // Simulate audio session interruption
        NotificationCenter.default.post(
            name: AVAudioSession.interruptionNotification,
            object: nil,
            userInfo: [
                AVAudioSessionInterruptionTypeKey: AVAudioSession.InterruptionType.began.rawValue
            ]
        )
        
        XCTAssertFalse(sut.isRecording, "Should stop recording on interruption")
    }
    
    // MARK: - Performance Tests
    func testProcessingPerformance() {
        measure {
            _ = sut.startRecording()
            Thread.sleep(forTimeInterval: 1.0)
            sut.stopRecording()
        }
    }
    
    // MARK: - Helper Methods
    private func injectTestAudioData() {
        guard let testAudioURL = Bundle(for: type(of: self)).url(forResource: "test_cry_patterns", withExtension: "wav"),
              let audioFile = try? AVAudioFile(forReading: testAudioURL) else {
            XCTFail("Failed to load test audio file")
            return
        }
        
        let format = audioFile.processingFormat
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(testBufferSize))!
        
        do {
            try audioFile.read(into: buffer)
            // Simulate audio input through private API for testing
            // Note: This is a test-only approach
            let mirror = Mirror(reflecting: sut)
            if let processMethod = mirror.children.first(where: { $0.label == "processAudioBuffer" })?.value as? (AVAudioPCMBuffer, AVAudioTime) -> Void {
                processMethod(buffer, AVAudioTime(hostTime: mach_absolute_time()))
            }
        } catch {
            XCTFail("Failed to process test audio: \(error)")
        }
    }
}