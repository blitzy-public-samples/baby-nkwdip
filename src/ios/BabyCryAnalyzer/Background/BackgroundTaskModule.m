#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <AVFoundation/AVFoundation.h>
#import <BackgroundTasks/BackgroundTasks.h>

// Error domain for module-specific errors
static NSString *const ErrorDomain = @"com.babycryanalyzer.backgroundtask";
static NSString *const BGTaskIdentifier = @"com.babycryanalyzer.monitoring";

// Error codes
typedef NS_ENUM(NSInteger, BackgroundTaskError) {
    BackgroundTaskErrorInvalidState = 1001,
    BackgroundTaskErrorAudioSessionFailed = 1002,
    BackgroundTaskErrorSchedulingFailed = 1003,
    BackgroundTaskErrorInvalidConfiguration = 1004
};

@interface BackgroundTaskModule : RCTEventEmitter <RCTBridgeModule>

@property (nonatomic, strong) AVAudioSession *audioSession;
@property (nonatomic, strong) BGTaskScheduler *taskScheduler;
@property (nonatomic, assign) BOOL isMonitoring;
@property (nonatomic, strong) NSDictionary *currentConfig;

@end

@implementation BackgroundTaskModule

RCT_EXPORT_MODULE()

- (instancetype)init {
    if (self = [super init]) {
        _audioSession = [AVAudioSession sharedInstance];
        _taskScheduler = [BGTaskScheduler sharedScheduler];
        _isMonitoring = NO;
        _currentConfig = @{
            @"monitoringInterval": @900, // 15 minutes default
            @"sensitivity": @"medium",
            @"noiseThreshold": @0.3
        };
        
        // Register for audio session interruption notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleAudioSessionInterruption:)
                                                   name:AVAudioSessionInterruptionNotification
                                                 object:nil];
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"monitoringStateChanged", @"backgroundTaskScheduled", @"audioSessionError"];
}

- (BOOL)initAudioSession {
    NSError *error = nil;
    
    // Configure audio session for background recording
    if (![_audioSession setCategory:AVAudioSessionCategoryRecord
                            mode:AVAudioSessionModeMeasurement
                         options:AVAudioSessionCategoryOptionAllowBluetooth
                           error:&error]) {
        return NO;
    }
    
    // Set active
    if (![_audioSession setActive:YES error:&error]) {
        return NO;
    }
    
    return YES;
}

- (void)scheduleBackgroundTask:(NSDictionary *)config {
    // Register background task
    [[BGTaskScheduler sharedScheduler] registerForTaskWithIdentifier:BGTaskIdentifier
                                                        usingQueue:dispatch_get_main_queue()
                                                     launchHandler:^(__kindof BGTask * _Nonnull task) {
        [self handleBackgroundTask:task];
    }];
    
    BGAppRefreshTaskRequest *request = [[BGAppRefreshTaskRequest alloc] initWithIdentifier:BGTaskIdentifier];
    NSTimeInterval interval = [config[@"monitoringInterval"] doubleValue];
    request.earliestBeginDate = [NSDate dateWithTimeIntervalSinceNow:interval];
    
    NSError *error = nil;
    if (![[BGTaskScheduler sharedScheduler] submitTaskRequest:request error:&error]) {
        [self sendEventWithName:@"backgroundTaskScheduled" body:@{@"success": @NO, @"error": error.localizedDescription}];
        return;
    }
    
    [self sendEventWithName:@"backgroundTaskScheduled" body:@{@"success": @YES}];
}

- (void)handleBackgroundTask:(BGTask *)task {
    // Ensure we reschedule before processing
    [self scheduleBackgroundTask:self.currentConfig];
    
    // Process audio in background
    [self processAudioInBackground:^(BOOL success, NSError *error) {
        if (success) {
            [task setTaskCompletedWithSuccess:YES];
        } else {
            [task setTaskCompletedWithSuccess:NO];
        }
    }];
}

- (void)processAudioInBackground:(void (^)(BOOL success, NSError *error))completion {
    // Implementation of audio processing logic
    // This would integrate with the audio analysis service
    completion(YES, nil);
}

RCT_EXPORT_METHOD(startBackgroundMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.isMonitoring) {
        reject(@"invalid_state", @"Background monitoring is already active", nil);
        return;
    }
    
    if (![self initAudioSession]) {
        NSError *error = [NSError errorWithDomain:ErrorDomain
                                           code:BackgroundTaskErrorAudioSessionFailed
                                       userInfo:@{NSLocalizedDescriptionKey: @"Failed to initialize audio session"}];
        reject(@"audio_session_failed", error.localizedDescription, error);
        return;
    }
    
    [self scheduleBackgroundTask:self.currentConfig];
    self.isMonitoring = YES;
    
    [self sendEventWithName:@"monitoringStateChanged" body:@{@"isMonitoring": @YES}];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopBackgroundMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.isMonitoring) {
        reject(@"invalid_state", @"Background monitoring is not active", nil);
        return;
    }
    
    [[BGTaskScheduler sharedScheduler] cancelAllTaskRequests];
    
    NSError *error = nil;
    if (![self.audioSession setActive:NO error:&error]) {
        reject(@"audio_session_failed", @"Failed to deactivate audio session", error);
        return;
    }
    
    self.isMonitoring = NO;
    [self sendEventWithName:@"monitoringStateChanged" body:@{@"isMonitoring": @NO}];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(getMonitoringStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{
        @"isMonitoring": @(self.isMonitoring),
        @"currentConfig": self.currentConfig
    });
}

RCT_EXPORT_METHOD(updateConfiguration:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (![self validateConfiguration:config]) {
        NSError *error = [NSError errorWithDomain:ErrorDomain
                                           code:BackgroundTaskErrorInvalidConfiguration
                                       userInfo:@{NSLocalizedDescriptionKey: @"Invalid configuration provided"}];
        reject(@"invalid_config", error.localizedDescription, error);
        return;
    }
    
    self.currentConfig = [self.currentConfig mutableCopy];
    [self.currentConfig addEntriesFromDictionary:config];
    
    if (self.isMonitoring) {
        [self scheduleBackgroundTask:self.currentConfig];
    }
    
    resolve(@{@"success": @YES});
}

- (BOOL)validateConfiguration:(NSDictionary *)config {
    // Validate configuration parameters
    if (config[@"monitoringInterval"]) {
        NSNumber *interval = config[@"monitoringInterval"];
        if ([interval doubleValue] < 900 || [interval doubleValue] > 3600) {
            return NO;
        }
    }
    
    if (config[@"sensitivity"]) {
        NSString *sensitivity = config[@"sensitivity"];
        if (![@[@"low", @"medium", @"high"] containsObject:sensitivity]) {
            return NO;
        }
    }
    
    if (config[@"noiseThreshold"]) {
        NSNumber *threshold = config[@"noiseThreshold"];
        if ([threshold doubleValue] < 0 || [threshold doubleValue] > 1) {
            return NO;
        }
    }
    
    return YES;
}

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
    NSInteger type = [notification.userInfo[AVAudioSessionInterruptionTypeKey] integerValue];
    
    if (type == AVAudioSessionInterruptionTypeBegan) {
        [self sendEventWithName:@"audioSessionError" 
                          body:@{@"type": @"interruption", @"message": @"Audio session interrupted"}];
    } else if (type == AVAudioSessionInterruptionTypeEnded) {
        if (self.isMonitoring) {
            [self initAudioSession];
        }
    }
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end