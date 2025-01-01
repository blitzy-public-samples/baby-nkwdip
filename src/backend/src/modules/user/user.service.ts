import { Injectable } from '@nestjs/common'; // v9.0.0
import { InjectModel } from '@nestjs/mongoose'; // v9.0.0
import { Model } from 'mongoose'; // v6.0.0
import { RateLimiterService } from '@nestjs/throttler'; // v4.0.0
import { AuditLogger } from '@nestjs/common'; // v9.0.0
import { CacheManager } from '@nestjs/cache-manager'; // v1.0.0
import { EncryptionService } from '@nestjs/security'; // v1.0.0
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt'; // v5.1.0
import { BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';

@Injectable()
export class UserService {
  // Constants for security configurations
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly PASSWORD_SALT_ROUNDS = 12;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly auditLogger: AuditLogger,
    private readonly cacheManager: CacheManager,
    private readonly encryptionService: EncryptionService,
    private readonly rateLimiter: RateLimiterService
  ) {}

  /**
   * Creates a new user with encrypted PII and secure password storage
   * @param createUserDto - User creation data transfer object
   * @returns Promise<User> - Created user document
   */
  async create(createUserDto: {
    email: string;
    password: string;
    name: string;
    roles?: string[];
  }): Promise<User> {
    try {
      // Validate password complexity
      this.validatePasswordComplexity(createUserDto.password);

      // Check email uniqueness
      const existingUser = await this.userModel.findOne({ 
        email: createUserDto.email.toLowerCase() 
      }).lean();
      
      if (existingUser) {
        throw new ConflictException('Email already registered');
      }

      // Encrypt PII data
      const encryptedName = await this.encryptionService.encrypt(
        createUserDto.name
      );

      // Hash password
      const hashedPassword = await bcrypt.hash(
        createUserDto.password, 
        this.PASSWORD_SALT_ROUNDS
      );

      // Create user document in transaction
      const session = await this.userModel.startSession();
      let newUser: User;

      try {
        session.startTransaction();

        newUser = await this.userModel.create([{
          email: createUserDto.email.toLowerCase(),
          password: hashedPassword,
          name: encryptedName,
          roles: createUserDto.roles || ['user'],
          isActive: true,
          lastLogin: null,
          deletedAt: null
        }], { session });

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      // Log audit trail
      await this.auditLogger.log({
        action: 'USER_CREATED',
        userId: newUser._id,
        email: newUser.email,
        roles: newUser.roles,
        timestamp: new Date()
      });

      // Cache user data
      await this.cacheManager.set(
        `user:${newUser._id}`,
        newUser.toSafeObject(),
        this.CACHE_TTL
      );

      // Return sanitized user
      return newUser.toSafeObject();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates user credentials with rate limiting and account lockout
   * @param email - User email
   * @param password - User password
   * @returns Promise<User> - Validated user document
   */
  async validateCredentials(
    email: string,
    password: string
  ): Promise<User> {
    try {
      // Check rate limit
      await this.rateLimiter.checkLimit(`auth:${email}`);

      // Check account lockout
      const lockoutKey = `lockout:${email}`;
      const isLocked = await this.cacheManager.get(lockoutKey);
      
      if (isLocked) {
        throw new UnauthorizedException('Account temporarily locked');
      }

      // Find user by email with password
      const user = await this.userModel
        .findOne({ email: email.toLowerCase(), isActive: true })
        .select('+password')
        .lean();

      if (!user) {
        await this.handleFailedLogin(email);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        await this.handleFailedLogin(email);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Reset login attempts on successful login
      await this.cacheManager.del(`attempts:${email}`);

      // Update last login
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      // Log successful authentication
      await this.auditLogger.log({
        action: 'USER_LOGIN',
        userId: user._id,
        email: user.email,
        timestamp: new Date(),
        success: true
      });

      // Return sanitized user
      delete user.password;
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handles failed login attempts and implements account lockout
   * @param email - User email
   */
  private async handleFailedLogin(email: string): Promise<void> {
    const attemptsKey = `attempts:${email}`;
    const attempts = (await this.cacheManager.get<number>(attemptsKey) || 0) + 1;
    
    await this.cacheManager.set(attemptsKey, attempts, this.LOCKOUT_DURATION);

    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      await this.cacheManager.set(
        `lockout:${email}`,
        true,
        this.LOCKOUT_DURATION
      );
    }

    // Log failed authentication
    await this.auditLogger.log({
      action: 'USER_LOGIN_FAILED',
      email,
      attempts,
      timestamp: new Date(),
      success: false
    });
  }

  /**
   * Validates password complexity requirements
   * @param password - Password to validate
   */
  private validatePasswordComplexity(password: string): void {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (
      password.length < minLength ||
      !hasUpperCase ||
      !hasLowerCase ||
      !hasNumbers ||
      !hasSpecialChar
    ) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain uppercase, lowercase, numbers and special characters'
      );
    }
  }
}