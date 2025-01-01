import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  UseGuards, 
  Query, 
  UseInterceptors,
  UnauthorizedException,
  NotFoundException,
  BadRequestException
} from '@nestjs/common'; // ^9.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity,
  ApiQuery 
} from '@nestjs/swagger'; // ^6.0.0
import { RateLimit } from '@nestjs/throttler'; // ^4.0.0
import { ValidationPipe } from '@nestjs/common'; // ^9.0.0

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { User } from './schemas/user.schema';

/**
 * Controller implementing secure user management endpoints with comprehensive
 * role-based access control, rate limiting, audit logging, and validation
 */
@Controller('users')
@ApiTags('users')
@UseGuards(RolesGuard)
@UseInterceptors(LoggingInterceptor)
@ApiSecurity('bearer')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Creates a new user with role-based access control
   */
  @Post()
  @Roles('Admin')
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body(new ValidationPipe()) createUserDto: CreateUserDto): Promise<User> {
    try {
      return await this.userService.create(createUserDto);
    } catch (error) {
      if (error.code === 11000) { // MongoDB duplicate key error
        throw new BadRequestException('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Retrieves paginated list of users with role-based filtering
   */
  @Get()
  @Roles('Admin', 'Expert')
  @RateLimit({ ttl: 60, limit: 100 })
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: ['Parent', 'Caregiver', 'Expert', 'Admin'] })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('role') role?: Role
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const query = role ? { roles: role } : {};
    
    const [users, total] = await Promise.all([
      this.userService.findAll(query, { skip, limit }),
      this.userService.count(query)
    ]);

    return {
      data: users,
      total,
      page: Number(page),
      limit: Number(limit)
    };
  }

  /**
   * Retrieves a specific user by ID with role-based access control
   */
  @Get(':id')
  @Roles('Admin', 'Expert')
  @RateLimit({ ttl: 60, limit: 100 })
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Param('id') id: string): Promise<User> {
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Updates a user's information with role-based access control
   */
  @Put(':id')
  @Roles('Admin')
  @RateLimit({ ttl: 60, limit: 20 })
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateUserDto: UpdateUserDto
  ): Promise<User> {
    const user = await this.userService.update(id, updateUserDto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Soft deletes a user with role-based access control
   */
  @Delete(':id')
  @Roles('Admin')
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.userService.remove(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Retrieves current user profile
   */
  @Get('profile/me')
  @RateLimit({ ttl: 60, limit: 100 })
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return this.userService.findOne(req.user.id);
  }
}