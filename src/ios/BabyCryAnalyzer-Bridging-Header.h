//
// BabyCryAnalyzer-Bridging-Header.h
// BabyCryAnalyzer
//
// Bridging header exposing Objective-C interfaces to Swift code
// Foundation: iOS 14.0+
// React: 0.71+
//

#ifndef BabyCryAnalyzer_Bridging_Header_h
#define BabyCryAnalyzer_Bridging_Header_h

// React Native Core - v0.71+
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Foundation Framework - iOS 14.0+
#import <Foundation/Foundation.h>

// Audio Capture Module
#import "AudioCaptureModule.h"
@class AudioCaptureModule;

// Background Task Module
#import "BackgroundTaskModule.h"
@class BackgroundTaskModule;

// Notification Module
#import "NotificationModule.h"
@class NotificationModule;

// MARK: - Global Type Definitions

// React Native Promise Callbacks
FOUNDATION_EXPORT typedef void (^RCTPromiseResolveBlock)(id result);
FOUNDATION_EXPORT typedef void (^RCTPromiseRejectBlock)(NSString *code, NSString *message, NSError *error);

// Audio Processing Callbacks
FOUNDATION_EXPORT typedef void (^AudioCompletionHandler)(NSDictionary *result, NSError *error);

// Background Task Callbacks
FOUNDATION_EXPORT typedef void (^BackgroundTaskCompletionHandler)(BOOL success, NSError *error);

#endif /* BabyCryAnalyzer_Bridging_Header_h */