import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  HttpStatus, 
  HttpCode,
  Req,
  UnauthorizedException,
  BadRequestException
} from '@nestjs/common'; // v9.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity,
  ApiBearerAuth
} from '@nestjs/swagger'; // v6.0.0
import { RateLimit, RateLimitGuard } from '@nestjs/throttler'; // v4.0.0
import { AuthService } from './auth.service';
import { Request } from 'express';

// DTOs for request validation
class LoginDto {
  email: string;
  password: string;
}

class RegisterDto {
  email: string;
  password: string;
  name: string;
}

class RefreshTokenDto {
  refreshToken: string;
}

// Response type for Swagger documentation
class AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

@Controller('auth')
@ApiTags('Authentication')
@ApiBearerAuth()
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    keyPrefix: 'login',
    points: 5,
    duration: 60,
    errorMessage: 'Too many login attempts. Please try again later.'
  })
  @ApiOperation({ summary: 'Authenticate user and receive tokens' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful', 
    type: AuthTokensResponse 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too many login attempts' 
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    try {
      // Validate request IP and rate limit
      const clientIp = req.ip || req.connection.remoteAddress;
      
      // Attempt authentication
      const tokens = await this.authService.login({
        email: loginDto.email.toLowerCase(),
        password: loginDto.password
      });

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Invalid login request');
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({
    keyPrefix: 'register',
    points: 3,
    duration: 3600,
    errorMessage: 'Too many registration attempts. Please try again later.'
  })
  @ApiOperation({ summary: 'Register new user account' })
  @ApiResponse({ 
    status: 201, 
    description: 'Registration successful', 
    type: AuthTokensResponse 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid registration data' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Email already registered' 
  })
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<AuthTokensResponse> {
    try {
      const tokens = await this.authService.register({
        email: registerDto.email.toLowerCase(),
        password: registerDto.password,
        name: registerDto.name
      });

      return tokens;
    } catch (error) {
      if (error.status === 409) {
        throw error;
      }
      throw new BadRequestException('Invalid registration data');
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    keyPrefix: 'refresh',
    points: 10,
    duration: 60,
    errorMessage: 'Too many refresh attempts. Please try again later.'
  })
  @ApiOperation({ summary: 'Refresh authentication tokens' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tokens refreshed successfully', 
    type: AuthTokensResponse 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid refresh token' 
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<AuthTokensResponse> {
    try {
      const tokens = await this.authService.refreshToken(
        refreshTokenDto.refreshToken
      );

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}