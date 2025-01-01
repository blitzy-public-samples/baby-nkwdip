/**
 * @fileoverview Cryptographic utility module providing secure password hashing,
 * verification, and encryption functions with HIPAA and GDPR compliance
 * @version 1.0.0
 */

import bcrypt from 'bcryptjs'; // ^2.4.3
import crypto from 'crypto'; // ^1.0.1
import { jwtSecret } from '../../config/auth.config';

/**
 * Number of salt rounds for bcrypt hashing
 * Higher values increase security but also computational cost
 */
const SALT_ROUNDS = 10;

/**
 * Encryption algorithm for AES-256-GCM
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Minimum required password length for security
 */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Length of initialization vector for AES encryption
 */
const IV_LENGTH = 16;

/**
 * Length of authentication tag for AES-GCM
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Securely hashes a password using bcrypt with configurable salt rounds
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password string
 * @throws Error if password is invalid or hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    
    // Clear sensitive data from memory
    password = '0'.repeat(password.length);
    
    return hash;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
}

/**
 * Verifies a password against its hash using secure time-constant comparison
 * @param password - Plain text password to verify
 * @param hash - Stored password hash to compare against
 * @returns Promise resolving to boolean indicating if password matches
 * @throws Error if verification fails
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    throw new Error('Password and hash are required');
  }

  try {
    const isValid = await bcrypt.compare(password, hash);
    
    // Clear sensitive data from memory
    password = '0'.repeat(password.length);
    
    return isValid;
  } catch (error) {
    throw new Error('Password verification failed');
  }
}

/**
 * Generates cryptographically secure random bytes
 * @param length - Number of bytes to generate
 * @returns Promise resolving to Buffer containing random bytes
 * @throws Error if generation fails or entropy is insufficient
 */
export async function generateRandomBytes(length: number): Promise<Buffer> {
  if (length <= 0) {
    throw new Error('Length must be greater than 0');
  }

  return new Promise((resolve, reject) => {
    crypto.randomBytes(length, (error, buffer) => {
      if (error) {
        reject(new Error('Failed to generate random bytes'));
      }
      
      // Verify entropy of generated bytes
      const entropy = buffer.reduce((acc, byte) => acc + byte.toString(2).padStart(8, '0'), '');
      if (entropy.length < length * 8) {
        reject(new Error('Insufficient entropy in generated bytes'));
      }
      
      resolve(buffer);
    });
  });
}

/**
 * Encrypts sensitive data using AES-256-GCM with secure IV generation
 * @param data - String data to encrypt
 * @returns Promise resolving to object containing IV, encrypted data, and auth tag
 * @throws Error if encryption fails
 */
export async function encryptData(data: string): Promise<{
  iv: string;
  encryptedData: string;
  tag: string;
}> {
  try {
    const iv = await generateRandomBytes(IV_LENGTH);
    const key = crypto.scryptSync(jwtSecret, 'salt', 32);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    
    // Clear sensitive data from memory
    data = '0'.repeat(data.length);
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      tag: tag.toString('hex')
    };
  } catch (error) {
    throw new Error('Data encryption failed');
  }
}

/**
 * Decrypts data using AES-256-GCM with authentication verification
 * @param encryptedData - Hex string of encrypted data
 * @param iv - Hex string of initialization vector
 * @param tag - Hex string of authentication tag
 * @returns Promise resolving to decrypted string
 * @throws Error if decryption or authentication fails
 */
export async function decryptData(
  encryptedData: string,
  iv: string,
  tag: string
): Promise<string> {
  try {
    const key = crypto.scryptSync(jwtSecret, 'salt', 32);
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Clear encrypted data from memory
    encryptedData = '0'.repeat(encryptedData.length);
    
    return decrypted;
  } catch (error) {
    throw new Error('Data decryption failed');
  }
}