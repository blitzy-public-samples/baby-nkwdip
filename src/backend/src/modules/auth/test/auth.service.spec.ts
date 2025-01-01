import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { JwtService } from '@nestjs/jwt'; // v9.0.0
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('AuthService', () => {
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  // Mock user data
  const mockUser = {
    _id: 'test-user-id',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    name: 'Test User',
    roles: ['user'],
    isActive: true,
    lastLogin: null,
    toSafeObject: () => ({
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['user']
    })
  };

  // Mock tokens
  const mockTokens = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    expiresIn: 3600,
    refreshExpiresIn: 604800
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            validateCredentials: jest.fn(),
            create: jest.fn(),
            findByEmail: jest.fn()
          }
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verifyAsync: jest.fn()
          }
        }
      ]
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'ValidPass123!'
    };

    it('should successfully authenticate user and return tokens', async () => {
      jest.spyOn(userService, 'validateCredentials').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock.token');

      const result = await authService.login(loginDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(userService.validateCredentials).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password
      );
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(userService, 'validateCredentials')
        .mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(authService.login(loginDto))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should enforce rate limiting', async () => {
      // Simulate rate limit exceeded
      for (let i = 0; i < 6; i++) {
        try {
          await authService.login(loginDto);
        } catch (error) {
          if (i === 5) {
            expect(error).toBeInstanceOf(UnauthorizedException);
            expect(error.message).toContain('Too many login attempts');
          }
        }
      }
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'ValidPass123!',
      name: 'New User'
    };

    it('should successfully register new user and return tokens', async () => {
      jest.spyOn(userService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock.token');

      const result = await authService.register(registerDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(userService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        roles: ['user']
      });
    });

    it('should throw BadRequestException for weak password', async () => {
      const weakPasswordDto = { ...registerDto, password: 'weak' };
      
      jest.spyOn(userService, 'create')
        .mockRejectedValue(new BadRequestException('Password too weak'));

      await expect(authService.register(weakPasswordDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'valid.refresh.token';

    it('should successfully refresh tokens', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'test-user-id',
        email: 'test@example.com',
        roles: ['user'],
        type: 'refresh'
      });
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock.token');

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jest.spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Invalid token'));

      await expect(authService.refreshToken('invalid.token'))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'test-user-id',
        email: 'test@example.com',
        roles: ['user'],
        type: 'refresh'
      });
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(null);

      await expect(authService.refreshToken(mockRefreshToken))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('private methods', () => {
    describe('verifyToken', () => {
      it('should verify access token correctly', async () => {
        const mockToken = 'valid.access.token';
        const mockPayload = {
          sub: 'test-user-id',
          email: 'test@example.com',
          roles: ['user'],
          type: 'access'
        };

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockPayload);

        // Access private method through any
        const result = await (authService as any).verifyToken(mockToken, 'access');

        expect(result).toEqual(mockPayload);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(
          mockToken,
          expect.any(Object)
        );
      });

      it('should throw UnauthorizedException for wrong token type', async () => {
        const mockToken = 'valid.token';
        const mockPayload = {
          sub: 'test-user-id',
          email: 'test@example.com',
          roles: ['user'],
          type: 'refresh'
        };

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockPayload);

        await expect((authService as any).verifyToken(mockToken, 'access'))
          .rejects
          .toThrow(UnauthorizedException);
      });
    });

    describe('getExpiryInSeconds', () => {
      it('should correctly convert time strings to seconds', () => {
        expect((authService as any).getExpiryInSeconds('1h')).toBe(3600);
        expect((authService as any).getExpiryInSeconds('7d')).toBe(604800);
        expect((authService as any).getExpiryInSeconds('30')).toBe(30);
      });
    });
  });
});