#import <React/RCTBridgeModule.h>  // v0.71+
#import <React/RCTEventEmitter.h>  // v0.71+
#import "BabyCryAnalyzer-Swift.h"

// MARK: - Constants
static NSString *const kErrorDomain = @"com.babycryanalyzer.notification";
static NSString *const kErrorInvalidData = @"INVALID_DATA";
static NSString *const kErrorPermissionDenied = @"PERMISSION_DENIED";
static NSString *const kErrorSystemError = @"SYSTEM_ERROR";

// MARK: - NotificationModule Implementation
@interface NotificationModule : RCTEventEmitter <RCTBridgeModule>

@property (nonatomic, strong) NotificationSecurityValidator *securityValidator;
@property (nonatomic, strong) NotificationPerformanceTracker *performanceTracker;

@end

@implementation NotificationModule {
    bool hasListeners;
}

// MARK: - Module Setup
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    if (self = [super init]) {
        _securityValidator = [[NotificationSecurityValidator alloc] init];
        _performanceTracker = [[NotificationPerformanceTracker alloc] init];
    }
    return self;
}

// MARK: - Event Emitter Methods
- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"onNotificationReceived",
        @"onNotificationFailed",
        @"onNotificationValidated",
        @"onNotificationMetrics"
    ];
}

- (void)startObserving {
    hasListeners = YES;
}

- (void)stopObserving {
    hasListeners = NO;
}

// MARK: - Public Methods
RCT_EXPORT_METHOD(requestPermissions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.performanceTracker startOperation:@"requestPermissions"];
    
    if (![self.securityValidator validatePermissionRequest]) {
        reject(kErrorPermissionDenied,
               @"Permission request validation failed",
               nil);
        return;
    }
    
    [[NotificationModule shared] requestNotificationPermissions:^(BOOL granted, NSError *error) {
        NSTimeInterval processingTime = [self.performanceTracker endOperation:@"requestPermissions"];
        
        if (error) {
            reject(kErrorSystemError,
                   error.localizedDescription,
                   error);
            return;
        }
        
        NSDictionary *result = @{
            @"granted": @(granted),
            @"processingTime": @(processingTime)
        };
        
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(scheduleNotification:(NSDictionary *)notificationData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.performanceTracker startOperation:@"scheduleNotification"];
    
    if (![self.securityValidator validateNotificationData:notificationData]) {
        reject(kErrorInvalidData,
               @"Invalid notification data",
               nil);
        return;
    }
    
    NSString *title = notificationData[@"title"];
    NSString *body = notificationData[@"body"];
    NSString *type = notificationData[@"type"];
    NSNumber *delay = notificationData[@"delay"] ?: @0;
    
    if (!title || !body || !type) {
        reject(kErrorInvalidData,
               @"Missing required notification fields",
               nil);
        return;
    }
    
    [[NotificationModule shared] scheduleNotificationWithTitle:title
                                                        body:body
                                                        type:type
                                                       delay:delay.doubleValue
                                                  completion:^(BOOL success, NSError *error) {
        NSTimeInterval processingTime = [self.performanceTracker endOperation:@"scheduleNotification"];
        
        if (!success) {
            reject(kErrorSystemError,
                   error.localizedDescription,
                   error);
            return;
        }
        
        NSDictionary *result = @{
            @"scheduled": @YES,
            @"timestamp": @([[NSDate date] timeIntervalSince1970]),
            @"processingTime": @(processingTime)
        };
        
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(clearAllNotifications:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.performanceTracker startOperation:@"clearAllNotifications"];
    
    [[NotificationModule shared] clearAllNotificationsWithCompletion:^(BOOL success, NSError *error) {
        NSTimeInterval processingTime = [self.performanceTracker endOperation:@"clearAllNotifications"];
        
        if (!success) {
            reject(kErrorSystemError,
                   error.localizedDescription,
                   error);
            return;
        }
        
        NSDictionary *result = @{
            @"cleared": @YES,
            @"processingTime": @(processingTime)
        };
        
        resolve(result);
    }];
}

// MARK: - Private Methods
- (void)sendEventIfListening:(NSString *)eventName body:(NSDictionary *)body {
    if (hasListeners) {
        [self sendEventWithName:eventName body:body];
    }
}

@end