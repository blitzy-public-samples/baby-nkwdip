import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common'; // v9.0.0
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  // Mock successful authentication response
  const mockAuthTokens = {
    accessToken: 'mock.access.token.with.proper.structure',
    refreshToken: 'mock.refresh.token.with.proper.structure',
    expiresIn: 3600,
    refreshExpiresIn: 604800
  };

  // Mock valid DTOs
  const validLoginDto: LoginDto = {
    email: 'test@example.com',
    password: 'SecurePass123!'
  };

  const validRegisterDto: RegisterDto = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    name: 'Test User'
  };

  beforeEach(async () => {
    // Create testing module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            register: jest.fn(),
            refreshToken: jest.fn(),
            validateRateLimit: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      // Arrange
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthTokens);
      const mockRequest = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };

      // Act
      const result = await controller.login(validLoginDto, mockRequest as any);

      // Assert
      expect(result).toEqual(mockAuthTokens);
      expect(authService.login).toHaveBeenCalledWith({
        email: validLoginDto.email.toLowerCase(),
        password: validLoginDto.password
      });
    });

    it('should handle rate limiting', async () => {
      // Arrange
      jest.spyOn(authService, 'login').mockRejectedValue(
        new UnauthorizedException('Too many login attempts. Please try again later.')
      );
      const mockRequest = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };

      // Act & Assert
      await expect(controller.login(validLoginDto, mockRequest as any))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      jest.spyOn(authService, 'login').mockRejectedValue(
        new UnauthorizedException('Invalid credentials')
      );
      const mockRequest = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };

      // Act & Assert
      await expect(controller.login(validLoginDto, mockRequest as any))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidLoginDto = { ...validLoginDto, email: 'invalid-email' };
      const mockRequest = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };

      // Act & Assert
      await expect(controller.login(invalidLoginDto as LoginDto, mockRequest as any))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('register', () => {
    it('should successfully register new user with valid data', async () => {
      // Arrange
      jest.spyOn(authService, 'register').mockResolvedValue(mockAuthTokens);

      // Act
      const result = await controller.register(validRegisterDto);

      // Assert
      expect(result).toEqual(mockAuthTokens);
      expect(authService.register).toHaveBeenCalledWith({
        email: validRegisterDto.email.toLowerCase(),
        password: validRegisterDto.password,
        name: validRegisterDto.name
      });
    });

    it('should handle existing email registration', async () => {
      // Arrange
      jest.spyOn(authService, 'register').mockRejectedValue(
        new ConflictException('Email already registered')
      );

      // Act & Assert
      await expect(controller.register(validRegisterDto))
        .rejects
        .toThrow(ConflictException);
    });

    it('should validate password complexity', async () => {
      // Arrange
      const weakPasswordDto = { ...validRegisterDto, password: 'weak' };

      // Act & Assert
      await expect(controller.register(weakPasswordDto as RegisterDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should validate name length', async () => {
      // Arrange
      const shortNameDto = { ...validRegisterDto, name: 'A' };

      // Act & Assert
      await expect(controller.register(shortNameDto as RegisterDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      // Arrange
      jest.spyOn(authService, 'refreshToken').mockResolvedValue(mockAuthTokens);
      const refreshTokenDto = { refreshToken: mockAuthTokens.refreshToken };

      // Act
      const result = await controller.refreshToken(refreshTokenDto);

      // Assert
      expect(result).toEqual(mockAuthTokens);
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      // Arrange
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(
        new UnauthorizedException('Invalid refresh token')
      );
      const invalidTokenDto = { refreshToken: 'invalid.refresh.token' };

      // Act & Assert
      await expect(controller.refreshToken(invalidTokenDto))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should handle expired refresh token', async () => {
      // Arrange
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(
        new UnauthorizedException('Refresh token expired')
      );
      const expiredTokenDto = { refreshToken: 'expired.refresh.token' };

      // Act & Assert
      await expect(controller.refreshToken(expiredTokenDto))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should handle rate limiting for refresh attempts', async () => {
      // Arrange
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(
        new UnauthorizedException('Too many refresh attempts')
      );
      const refreshTokenDto = { refreshToken: mockAuthTokens.refreshToken };

      // Act & Assert
      await expect(controller.refreshToken(refreshTokenDto))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('security measures', () => {
    it('should convert email to lowercase before processing', async () => {
      // Arrange
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthTokens);
      const mockRequest = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };
      const mixedCaseLoginDto = { ...validLoginDto, email: 'Test@Example.COM' };

      // Act
      await controller.login(mixedCaseLoginDto as LoginDto, mockRequest as any);

      // Assert
      expect(authService.login).toHaveBeenCalledWith({
        email: mixedCaseLoginDto.email.toLowerCase(),
        password: mixedCaseLoginDto.password
      });
    });

    it('should handle concurrent login attempts', async () => {
      // Arrange
      const mockRequest = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };
      const loginPromises = Array(6).fill(null).map(() => 
        controller.login(validLoginDto, mockRequest as any)
      );

      // Act & Assert
      await expect(Promise.all(loginPromises))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should validate request IP address', async () => {
      // Arrange
      const mockRequest = { ip: null, connection: { remoteAddress: null } };

      // Act & Assert
      await expect(controller.login(validLoginDto, mockRequest as any))
        .rejects
        .toThrow(BadRequestException);
    });
  });
});