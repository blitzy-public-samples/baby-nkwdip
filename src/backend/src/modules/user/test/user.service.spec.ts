import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { getModelToken } from '@nestjs/mongoose'; // v9.0.0
import { Model } from 'mongoose'; // v6.0.0
import { AuditLogger, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common'; // v9.0.0
import { RateLimiterService } from '@nestjs/throttler'; // v4.0.0
import { CacheManager } from '@nestjs/cache-manager'; // v1.0.0
import { EncryptionService } from '@nestjs/security'; // v1.0.0
import { UserService } from '../user.service';
import { User } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt'; // v5.1.0

describe('UserService', () => {
  let service: UserService;
  let userModel: Model<User>;
  let auditLogger: jest.Mocked<AuditLogger>;
  let cacheManager: jest.Mocked<CacheManager>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let rateLimiter: jest.Mocked<RateLimiterService>;

  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    password: 'hashedPassword123',
    name: 'Test User',
    roles: ['user'],
    isActive: true,
    lastLogin: null,
    deletedAt: null,
    toSafeObject: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
            startSession: jest.fn(() => ({
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              abortTransaction: jest.fn(),
              endSession: jest.fn()
            })),
            lean: jest.fn()
          }
        },
        {
          provide: AuditLogger,
          useValue: {
            log: jest.fn()
          }
        },
        {
          provide: CacheManager,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
          }
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn()
          }
        },
        {
          provide: RateLimiterService,
          useValue: {
            checkLimit: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<UserService>(UserService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
    auditLogger = module.get(AuditLogger);
    cacheManager = module.get(CacheManager);
    encryptionService = module.get(EncryptionService);
    rateLimiter = module.get(RateLimiterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      email: 'test@example.com',
      password: 'ValidP@ssw0rd',
      name: 'Test User',
      roles: ['user']
    };

    it('should create a user with encrypted data and audit log', async () => {
      const encryptedName = 'encrypted_name';
      const hashedPassword = 'hashed_password';

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      encryptionService.encrypt.mockResolvedValue(encryptedName);
      userModel.findOne = jest.fn().mockReturnValue({ lean: () => null });
      userModel.create = jest.fn().mockResolvedValue([mockUser]);
      mockUser.toSafeObject.mockReturnValue({ ...mockUser, password: undefined });

      const result = await service.create(createUserDto);

      expect(encryptionService.encrypt).toHaveBeenCalledWith(createUserDto.name);
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(userModel.create).toHaveBeenCalledWith([
        expect.objectContaining({
          email: createUserDto.email.toLowerCase(),
          password: hashedPassword,
          name: encryptedName,
          roles: createUserDto.roles
        })
      ], expect.any(Object));
      expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_CREATED',
        userId: mockUser._id,
        email: mockUser.email
      }));
      expect(result).toBeDefined();
    });

    it('should reject weak passwords', async () => {
      const weakPassword = 'weak';
      await expect(service.create({
        ...createUserDto,
        password: weakPassword
      })).rejects.toThrow(BadRequestException);
    });

    it('should prevent duplicate email registration', async () => {
      userModel.findOne = jest.fn().mockReturnValue({ 
        lean: () => ({ ...mockUser }) 
      });

      await expect(service.create(createUserDto))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('validateCredentials', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'ValidP@ssw0rd'
    };

    it('should validate correct credentials and update login timestamp', async () => {
      rateLimiter.checkLimit.mockResolvedValue(undefined);
      cacheManager.get.mockResolvedValue(null);
      userModel.findOne = jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({ ...mockUser })
        })
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.validateCredentials(
        credentials.email,
        credentials.password
      );

      expect(rateLimiter.checkLimit).toHaveBeenCalled();
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        { $set: { lastLogin: expect.any(Date) } }
      );
      expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_LOGIN',
        success: true
      }));
      expect(result).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      rateLimiter.checkLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(service.validateCredentials(
        credentials.email,
        credentials.password
      )).rejects.toThrow();
    });

    it('should enforce account lockout after failed attempts', async () => {
      rateLimiter.checkLimit.mockResolvedValue(undefined);
      cacheManager.get.mockResolvedValueOnce(null) // Not locked
        .mockResolvedValueOnce(5); // Max attempts reached
      userModel.findOne = jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({ ...mockUser })
        })
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.validateCredentials(
        credentials.email,
        credentials.password
      )).rejects.toThrow(UnauthorizedException);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `lockout:${credentials.email}`,
        true,
        expect.any(Number)
      );
      expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_LOGIN_FAILED',
        success: false
      }));
    });

    it('should reject login attempts for locked accounts', async () => {
      rateLimiter.checkLimit.mockResolvedValue(undefined);
      cacheManager.get.mockResolvedValue(true); // Account locked

      await expect(service.validateCredentials(
        credentials.email,
        credentials.password
      )).rejects.toThrow('Account temporarily locked');
    });
  });
});