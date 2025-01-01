// @react-native-async-storage/async-storage v1.17.11
import AsyncStorage from '@react-native-async-storage/async-storage';
// crypto-js v4.1.1
import CryptoJS from 'crypto-js';

// Global configuration
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || '';
const TOKEN_CONFIG = {
  accessTokenLifetime: 3600, // 1 hour in seconds
  refreshTokenLifetime: 2592000, // 30 days in seconds
};

// Custom error class for storage operations
class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Decorator for error handling
function throwsStorageError(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      throw new StorageError(`Storage operation failed: ${error.message}`);
    }
  };
  return descriptor;
}

// Decorator for key validation
function validateKey(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (key: string, ...args: any[]) {
    if (!key || typeof key !== 'string') {
      throw new StorageError('Invalid storage key provided');
    }
    return await originalMethod.apply(this, [key, ...args]);
  };
  return descriptor;
}

// Decorator for token validation
function validateTokens(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (accessToken: string, refreshToken: string, ...args: any[]) {
    if (!accessToken || !refreshToken) {
      throw new StorageError('Invalid tokens provided');
    }
    return await originalMethod.apply(this, [accessToken, refreshToken, ...args]);
  };
  return descriptor;
}

/**
 * Securely stores data with AES-256 encryption
 * @param key Storage key
 * @param value Data to store
 */
@throwsStorageError
export async function setSecureItem(key: string, value: any): Promise<void> {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(stringValue, ENCRYPTION_KEY, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const combined = iv.toString() + encrypted.toString();
    await AsyncStorage.setItem(key, combined);
  } finally {
    // Clear sensitive data from memory
    value = null;
  }
}

/**
 * Retrieves and decrypts data from storage
 * @param key Storage key
 * @returns Decrypted data or null if not found
 */
@throwsStorageError
@validateKey
export async function getSecureItem(key: string): Promise<any> {
  const encrypted = await AsyncStorage.getItem(key);
  if (!encrypted) return null;

  try {
    const ivStr = encrypted.substr(0, 32);
    const dataStr = encrypted.substr(32);
    const iv = CryptoJS.enc.Hex.parse(ivStr);
    
    const decrypted = CryptoJS.AES.decrypt(dataStr, ENCRYPTION_KEY, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  } finally {
    // Clear sensitive data
    encrypted.length = 0;
  }
}

/**
 * Securely removes item from storage
 * @param key Storage key
 */
@throwsStorageError
export async function removeSecureItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  // Verify removal
  const item = await AsyncStorage.getItem(key);
  if (item) {
    throw new StorageError('Failed to remove item from storage');
  }
}

/**
 * Clears all secure storage
 */
@throwsStorageError
export async function clearSecureStorage(): Promise<void> {
  await AsyncStorage.clear();
  // Verify clear
  const keys = await AsyncStorage.getAllKeys();
  if (keys.length > 0) {
    throw new StorageError('Failed to clear storage');
  }
}

/**
 * Stores authentication tokens with expiration
 * @param accessToken Access token
 * @param refreshToken Refresh token
 */
@throwsStorageError
@validateTokens
export async function setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  const now = Date.now();
  const tokens = {
    accessToken: {
      value: accessToken,
      expiresAt: now + (TOKEN_CONFIG.accessTokenLifetime * 1000)
    },
    refreshToken: {
      value: refreshToken,
      expiresAt: now + (TOKEN_CONFIG.refreshTokenLifetime * 1000)
    }
  };

  try {
    await setSecureItem('auth_tokens', tokens);
  } finally {
    // Clear sensitive data
    accessToken = '';
    refreshToken = '';
  }
}

/**
 * Retrieves valid authentication tokens
 * @returns Token object or null if expired/invalid
 */
@throwsStorageError
export async function getAuthTokens(): Promise<{ accessToken: string; refreshToken: string; } | null> {
  const tokens = await getSecureItem('auth_tokens');
  if (!tokens) return null;

  const now = Date.now();
  
  // Check expiration
  if (tokens.accessToken.expiresAt < now || tokens.refreshToken.expiresAt < now) {
    await removeSecureItem('auth_tokens');
    return null;
  }

  return {
    accessToken: tokens.accessToken.value,
    refreshToken: tokens.refreshToken.value
  };
}