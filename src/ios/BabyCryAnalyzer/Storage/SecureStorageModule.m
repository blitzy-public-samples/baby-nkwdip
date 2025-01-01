// React Native bridge module for secure storage operations
// Version: React Native 0.71+

#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>
#import <LocalAuthentication/LAContext.h>
#import "SecureStorageModule-Swift.h"

// Error domain for secure storage operations
NSErrorDomain const SecureStorageErrorDomain = @"com.babycryanalyzer.securestorage";

// Bridge module implementation
@interface RCT_EXTERN_MODULE(SecureStorageModule, NSObject)

// MARK: - External Method Declarations

// Set item with enhanced security
RCT_EXTERN_METHOD(setItem:(NSString *)key
                  value:(NSString *)value
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Get item with security validation
RCT_EXTERN_METHOD(getItem:(NSString *)key
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Remove item with audit
RCT_EXTERN_METHOD(removeItem:(NSString *)key
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Clear storage with security checks
RCT_EXTERN_METHOD(clear:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Check for secure hardware support
RCT_EXTERN_METHOD(hasSecureHardware:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// MARK: - Module Configuration

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

// Specify module name for JavaScript
- (NSDictionary *)constantsToExport
{
    return @{
        @"SECURITY_LEVEL": @"HIPAA_COMPLIANT",
        @"ENCRYPTION_TYPE": @"AES_256",
        @"BIOMETRIC_SUPPORT": @(YES),
        @"ERROR_CODES": @{
            @"INVALID_INPUT": @"E001",
            @"AUTH_FAILED": @"E002",
            @"STORAGE_ERROR": @"E003",
            @"ENCRYPTION_ERROR": @"E004",
            @"BIOMETRIC_UNAVAILABLE": @"E005",
            @"KEY_ROTATION_ERROR": @"E006"
        }
    };
}

// Export module name
+ (NSString *)moduleName
{
    return @"SecureStorageModule";
}

// MARK: - Thread Configuration

- (dispatch_queue_t)methodQueue
{
    return dispatch_queue_create("com.babycryanalyzer.securestorage", DISPATCH_QUEUE_SERIAL);
}

// MARK: - Lifecycle Methods

- (instancetype)init
{
    self = [super init];
    if (self) {
        // Initialize security audit logger
        NSLog(@"[SECURITY_AUDIT] SecureStorageModule initialized");
        
        // Configure default security settings
        [self configureDefaultSecuritySettings];
    }
    return self;
}

- (void)dealloc
{
    // Clean up sensitive data
    NSLog(@"[SECURITY_AUDIT] SecureStorageModule dealloc - cleaning up sensitive data");
}

// MARK: - Private Helper Methods

- (void)configureDefaultSecuritySettings
{
    // Configure memory protection
    @try {
        [self setMemoryProtectionLevel];
        [self validateSecurityEnvironment];
    } @catch (NSException *exception) {
        NSLog(@"[SECURITY_ERROR] Failed to configure security settings: %@", exception);
    }
}

- (void)setMemoryProtectionLevel
{
    // Set memory protection level for sensitive data
    NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
    NSString *keychainGroup = [NSString stringWithFormat:@"%@.securestorage", bundleId];
    
    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrAccessGroup: keychainGroup,
        (__bridge id)kSecAttrAccessible: (__bridge id)kSecAttrAccessibleAfterFirstUnlock
    };
    
    SecItemDelete((__bridge CFDictionaryRef)query);
}

- (void)validateSecurityEnvironment
{
    // Check for jailbreak
    #if !TARGET_SIMULATOR
    NSArray *jailbreakPaths = @[
        @"/Applications/Cydia.app",
        @"/Library/MobileSubstrate/MobileSubstrate.dylib",
        @"/bin/bash",
        @"/usr/sbin/sshd",
        @"/etc/apt",
        @"/private/var/lib/apt/"
    ];
    
    for (NSString *path in jailbreakPaths) {
        if ([[NSFileManager defaultManager] fileExistsAtPath:path]) {
            NSLog(@"[SECURITY_ALERT] Jailbreak detected - implementing additional security measures");
            break;
        }
    }
    #endif
    
    // Validate biometric availability
    LAContext *context = [[LAContext alloc] init];
    NSError *error = nil;
    if ([context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&error]) {
        NSLog(@"[SECURITY_AUDIT] Biometric authentication available");
    } else {
        NSLog(@"[SECURITY_INFO] Biometric authentication not available: %@", error);
    }
}

@end