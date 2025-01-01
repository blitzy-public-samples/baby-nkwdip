import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Request, 
  HttpStatus, 
  HttpException,
  Logger,
  Query,
  ParseUUIDPipe
} from '@nestjs/common'; // v9.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery, 
  ApiBearerAuth 
} from '@nestjs/swagger'; // v5.0.0
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BabyService } from './baby.service';
import { CreateBabyDto } from './dto/create-baby.dto';
import { UpdateBabyDto } from './dto/update-baby.dto';
import { BabyDocument } from './schemas/baby.schema';

@ApiTags('babies')
@ApiBearerAuth()
@Controller('babies')
@UseGuards(JwtAuthGuard)
export class BabyController {
  private readonly logger = new Logger(BabyController.name);

  constructor(private readonly babyService: BabyService) {
    this.logger.log('Initializing BabyController');
  }

  @Post()
  @ApiOperation({ summary: 'Create new baby profile' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Baby profile created successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Unauthorized access' 
  })
  async create(
    @Body() createBabyDto: CreateBabyDto,
    @Request() req
  ): Promise<BabyDocument> {
    try {
      this.logger.debug('Creating baby profile', { userId: req.user.id });
      const baby = await this.babyService.create(createBabyDto, req.user.id);
      this.logger.log('Baby profile created successfully', { babyId: baby._id });
      return baby;
    } catch (error) {
      this.logger.error('Failed to create baby profile', { error, userId: req.user.id });
      throw new HttpException(
        'Failed to create baby profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all baby profiles for user' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Retrieved baby profiles successfully' 
  })
  async findAll(
    @Request() req,
    @Query('isActive') isActive?: boolean
  ): Promise<BabyDocument[]> {
    try {
      this.logger.debug('Retrieving baby profiles', { userId: req.user.id });
      const babies = await this.babyService.findById(req.user.id, isActive);
      return babies;
    } catch (error) {
      this.logger.error('Failed to retrieve baby profiles', { error, userId: req.user.id });
      throw new HttpException(
        'Failed to retrieve baby profiles',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get baby profile by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Retrieved baby profile successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Baby profile not found' 
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<BabyDocument> {
    try {
      this.logger.debug('Retrieving baby profile', { babyId: id, userId: req.user.id });
      const baby = await this.babyService.findById(id, req.user.id);
      if (!baby) {
        throw new HttpException('Baby profile not found', HttpStatus.NOT_FOUND);
      }
      return baby;
    } catch (error) {
      this.logger.error('Failed to retrieve baby profile', { error, babyId: id });
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve baby profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update baby profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Baby profile updated successfully' 
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBabyDto: UpdateBabyDto,
    @Request() req
  ): Promise<BabyDocument> {
    try {
      this.logger.debug('Updating baby profile', { babyId: id, userId: req.user.id });
      const updatedBaby = await this.babyService.updatePreferences(
        id,
        updateBabyDto.toUpdateEntity()
      );
      this.logger.log('Baby profile updated successfully', { babyId: id });
      return updatedBaby;
    } catch (error) {
      this.logger.error('Failed to update baby profile', { error, babyId: id });
      throw new HttpException(
        'Failed to update baby profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate baby profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Baby profile deactivated successfully' 
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<void> {
    try {
      this.logger.debug('Deactivating baby profile', { babyId: id, userId: req.user.id });
      await this.babyService.deactivate(id, req.user.id);
      this.logger.log('Baby profile deactivated successfully', { babyId: id });
    } catch (error) {
      this.logger.error('Failed to deactivate baby profile', { error, babyId: id });
      throw new HttpException(
        'Failed to deactivate baby profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get baby profile statistics' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Retrieved baby statistics successfully' 
  })
  async getStatistics(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<Record<string, any>> {
    try {
      this.logger.debug('Retrieving baby statistics', { babyId: id, userId: req.user.id });
      const stats = await this.babyService.getPatternStatistics(id);
      return stats;
    } catch (error) {
      this.logger.error('Failed to retrieve baby statistics', { error, babyId: id });
      throw new HttpException(
        'Failed to retrieve baby statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}