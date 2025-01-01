//
// AudioCaptureModule.m
// BabyCryAnalyzer
//
// React Native bridge module for iOS audio capture with enhanced error handling
// and performance monitoring capabilities.
//
// Foundation: iOS 14.0+
// React: 0.71+
//

#import "AudioCaptureModule.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <AVFoundation/AVFoundation.h>

// MARK: - Constants
static NSString *const kEventAudioLevelUpdate = @"onAudioLevelUpdate";
static NSString *const kEventCryDetected = @"onCryDetected";
static NSString *const kEventError = @"onError";
static NSString *const kEventMetricsUpdate = @"onMetricsUpdate";

@interface AudioCaptureModule () <AudioProcessorDelegate>

@property (nonatomic, strong) AudioProcessor *audioProcessor;
@property (nonatomic, strong) AudioConfiguration *configuration;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, strong) dispatch_queue_t processingQueue;
@property (nonatomic, strong) NSMutableDictionary *performanceMetrics;
@property (nonatomic, strong) NSLock *stateLock;

@end

@implementation AudioCaptureModule

// MARK: - RCTBridgeModule Implementation
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[kEventAudioLevelUpdate,
             kEventCryDetected,
             kEventError,
             kEventMetricsUpdate];
}

// MARK: - Lifecycle Methods
- (instancetype)init {
    if (self = [super init]) {
        _processingQueue = dispatch_queue_create("com.babycryanalyzer.capture", DISPATCH_QUEUE_SERIAL);
        _performanceMetrics = [NSMutableDictionary dictionary];
        _stateLock = [[NSLock alloc] init];
        
        // Initialize audio configuration
        _configuration = [[AudioConfiguration alloc] initWithSampleRate:44100.0
                                                          bufferSize:4096
                                                     noiseThreshold:-50.0
                                              cryDetectionThreshold:0.85
                                               minimumCryDuration:1.5];
        
        // Initialize audio processor
        NSError *error;
        _audioProcessor = [[AudioProcessor alloc] initWithConfig:_configuration error:&error];
        if (error) {
            NSLog(@"Failed to initialize AudioProcessor: %@", error);
        }
        _audioProcessor.delegate = self;
    }
    return self;
}

// MARK: - React Native Methods
RCT_EXPORT_METHOD(startRecording:(NSDictionary *)options
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_processingQueue, ^{
        [self.stateLock lock];
        @try {
            if (!self.audioProcessor) {
                reject(@"INIT_ERROR", @"Audio processor not initialized", nil);
                return;
            }
            
            NSError *error;
            BOOL success = [self.audioProcessor startRecording:&error];
            
            if (success) {
                [self startPerformanceMonitoring];
                resolve(@{@"status": @"recording"});
            } else {
                reject(@"RECORDING_ERROR",
                       error.localizedDescription,
                       error);
            }
        } @finally {
            [self.stateLock unlock];
        }
    });
}

RCT_EXPORT_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_processingQueue, ^{
        [self.stateLock lock];
        @try {
            [self.audioProcessor stopRecording];
            [self stopPerformanceMonitoring];
            
            resolve(@{
                @"status": @"stopped",
                @"metrics": self.performanceMetrics
            });
        } @finally {
            [self.stateLock unlock];
        }
    });
}

RCT_EXPORT_METHOD(isRecording:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{@"recording": @(self.audioProcessor.isRecording)});
}

RCT_EXPORT_METHOD(getMetrics:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject) {
    resolve(self.performanceMetrics);
}

// MARK: - RCTEventEmitter Methods
- (void)startObserving {
    [self.stateLock lock];
    self.hasListeners = YES;
    [self.stateLock unlock];
}

- (void)stopObserving {
    [self.stateLock lock];
    self.hasListeners = NO;
    [self.stateLock unlock];
}

// MARK: - AudioProcessorDelegate Methods
- (void)audioProcessorDidStartRecording {
    if (!self.hasListeners) return;
    [self sendEventWithName:kEventMetricsUpdate
                      body:@{@"status": @"recording"}];
}

- (void)audioProcessorDidStopRecording {
    if (!self.hasListeners) return;
    [self sendEventWithName:kEventMetricsUpdate
                      body:@{@"status": @"stopped"}];
}

- (void)audioProcessorDidDetectAudioLevel:(float)audioLevel {
    if (!self.hasListeners) return;
    [self sendEventWithName:kEventAudioLevelUpdate
                      body:@{@"level": @(audioLevel)}];
}

- (void)audioProcessorDidDetectCryWithPatternType:(NSString *)patternType
                                      confidence:(float)confidence {
    if (!self.hasListeners) return;
    [self sendEventWithName:kEventCryDetected
                      body:@{
                          @"type": patternType,
                          @"confidence": @(confidence),
                          @"timestamp": @([[NSDate date] timeIntervalSince1970])
                      }];
}

// MARK: - Private Methods
- (void)startPerformanceMonitoring {
    self.performanceMetrics[@"startTime"] = @([[NSDate date] timeIntervalSince1970]);
    self.performanceMetrics[@"bufferOverruns"] = @(0);
    self.performanceMetrics[@"processingTime"] = @(0);
}

- (void)stopPerformanceMonitoring {
    NSTimeInterval endTime = [[NSDate date] timeIntervalSince1970];
    NSTimeInterval startTime = [self.performanceMetrics[@"startTime"] doubleValue];
    self.performanceMetrics[@"duration"] = @(endTime - startTime);
    self.performanceMetrics[@"completed"] = @YES;
}

@end