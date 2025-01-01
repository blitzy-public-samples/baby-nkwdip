import { Test, TestingModule } from '@nestjs/testing'; // ^9.0.0
import { HttpStatus } from '@nestjs/common'; // ^9.0.0
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { EncryptionService } from '@nestjs/security'; // ^1.0.0
import { AuditLogger } from '@nestjs/common'; // ^9.0.0

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;
  let rolesGuard: jest.Mocked<RolesGuard>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let auditLogger: jest.Mocked<AuditLogger>;

  const mockUser = {
    _id: 'test-id',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['Parent'],
    isActive: true,
    lastLogin: new Date(),
    deletedAt: null
  };

  beforeEach(async () => {
    // Create mock implementations
    const userServiceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      count: jest.fn()
    };

    const rolesGuardMock = {
      canActivate: jest.fn()
    };

    const encryptionServiceMock = {
      encrypt: jest.fn(),
      decrypt: jest.fn()
    };

    const auditLoggerMock = {
      log: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: RolesGuard, useValue: rolesGuardMock },
        { provide: EncryptionService, useValue: encryptionServiceMock },
        { provide: AuditLogger, useValue: auditLoggerMock },
        LoggingInterceptor
      ]
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
    rolesGuard = module.get(RolesGuard);
    encryptionService = module.get(EncryptionService);
    auditLogger = module.get(AuditLogger);
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'new@example.com',
      password: 'Test123!@#',
      name: 'New User'
    };

    it('should require Admin role to create users', async () => {
      rolesGuard.canActivate.mockResolvedValue(false);
      
      await expect(controller.create(createUserDto))
        .rejects
        .toThrow('Forbidden resource');

      expect(rolesGuard.canActivate).toHaveBeenCalledWith(
        expect.objectContaining({ 
          getHandler: expect.any(Function),
          getClass: expect.any(Function)
        })
      );
    });

    it('should encrypt PII data before storing', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      encryptionService.encrypt.mockResolvedValue('encrypted-name');
      userService.create.mockResolvedValue(mockUser);

      await controller.create(createUserDto);

      expect(encryptionService.encrypt).toHaveBeenCalledWith(createUserDto.name);
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'encrypted-name'
        })
      );
    });

    it('should log audit trail for user creation', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.create.mockResolvedValue(mockUser);

      await controller.create(createUserDto);

      expect(auditLogger.log).toHaveBeenCalledWith({
        action: 'USER_CREATED',
        userId: mockUser._id,
        email: mockUser.email,
        roles: mockUser.roles,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('findAll', () => {
    const mockPaginatedResponse = {
      data: [mockUser],
      total: 1,
      page: 1,
      limit: 10
    };

    it('should allow only Admin and Expert roles', async () => {
      rolesGuard.canActivate.mockResolvedValue(false);
      
      await expect(controller.findAll())
        .rejects
        .toThrow('Forbidden resource');

      expect(rolesGuard.canActivate).toHaveBeenCalled();
    });

    it('should implement pagination with role filtering', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.findAll.mockResolvedValue([mockUser]);
      userService.count.mockResolvedValue(1);

      const result = await controller.findAll(1, 10, 'Parent' as Role);

      expect(result).toEqual(mockPaginatedResponse);
      expect(userService.findAll).toHaveBeenCalledWith(
        { roles: 'Parent' },
        { skip: 0, limit: 10 }
      );
    });

    it('should decrypt PII data in response', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.findAll.mockResolvedValue([mockUser]);
      userService.count.mockResolvedValue(1);
      encryptionService.decrypt.mockResolvedValue('decrypted-name');

      const result = await controller.findAll();

      expect(encryptionService.decrypt).toHaveBeenCalledWith(mockUser.name);
      expect(result.data[0].name).toBe('decrypted-name');
    });
  });

  describe('findOne', () => {
    it('should enforce role-based access control', async () => {
      rolesGuard.canActivate.mockResolvedValue(false);
      
      await expect(controller.findOne('test-id'))
        .rejects
        .toThrow('Forbidden resource');
    });

    it('should handle non-existent users securely', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.findOne.mockResolvedValue(null);

      await expect(controller.findOne('non-existent'))
        .rejects
        .toThrow('User not found');
    });

    it('should log access attempts', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.findOne.mockResolvedValue(mockUser);

      await controller.findOne('test-id');

      expect(auditLogger.log).toHaveBeenCalledWith({
        action: 'USER_ACCESSED',
        userId: 'test-id',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name'
    };

    it('should require Admin role', async () => {
      rolesGuard.canActivate.mockResolvedValue(false);
      
      await expect(controller.update('test-id', updateUserDto))
        .rejects
        .toThrow('Forbidden resource');
    });

    it('should encrypt updated PII data', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      encryptionService.encrypt.mockResolvedValue('encrypted-updated-name');
      userService.update.mockResolvedValue(mockUser);

      await controller.update('test-id', updateUserDto);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('Updated Name');
      expect(userService.update).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          name: 'encrypted-updated-name'
        })
      );
    });

    it('should log update audit trail', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.update.mockResolvedValue(mockUser);

      await controller.update('test-id', updateUserDto);

      expect(auditLogger.log).toHaveBeenCalledWith({
        action: 'USER_UPDATED',
        userId: 'test-id',
        changes: expect.any(Object),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('remove', () => {
    it('should implement soft delete with Admin role', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.remove.mockResolvedValue(true);

      await controller.remove('test-id');

      expect(userService.remove).toHaveBeenCalledWith('test-id');
      expect(auditLogger.log).toHaveBeenCalledWith({
        action: 'USER_DELETED',
        userId: 'test-id',
        timestamp: expect.any(Date)
      });
    });

    it('should prevent hard deletion of user data', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);
      userService.remove.mockResolvedValue(true);

      await controller.remove('test-id');

      // Verify soft delete was called instead of database removal
      expect(userService.remove).toHaveBeenCalledWith(
        expect.not.stringContaining('deleteOne')
      );
    });
  });

  describe('getProfile', () => {
    it('should require authentication', async () => {
      const req = { user: null };
      
      await expect(controller.getProfile(req))
        .rejects
        .toThrow('Unauthorized');
    });

    it('should return decrypted profile data', async () => {
      const req = { user: { id: 'test-id' } };
      userService.findOne.mockResolvedValue(mockUser);
      encryptionService.decrypt.mockResolvedValue('decrypted-name');

      const result = await controller.getProfile(req);

      expect(result.name).toBe('decrypted-name');
      expect(encryptionService.decrypt).toHaveBeenCalledWith(mockUser.name);
    });
  });
});