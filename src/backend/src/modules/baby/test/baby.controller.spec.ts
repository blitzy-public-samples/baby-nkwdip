import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { HttpStatus, HttpException } from '@nestjs/common'; // v9.0.0
import { performance } from 'perf_hooks';
import { BabyController } from '../baby.controller';
import { BabyService } from '../baby.service';
import { CreateBabyDto } from '../dto/create-baby.dto';
import { UpdateBabyDto } from '../dto/update-baby.dto';

// Mock BabyService implementation
jest.mock('../baby.service');

describe('BabyController', () => {
  let controller: BabyController;
  let service: jest.Mocked<BabyService>;
  let module: TestingModule;

  // Test data fixtures
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'parent'
  };

  const mockRequest = {
    user: testUser,
    headers: {
      authorization: 'Bearer test-token'
    }
  };

  const validBabyData = {
    name: 'Test Baby',
    birthDate: new Date('2023-01-01'),
    preferences: {
      backgroundMonitoring: false,
      notificationsEnabled: true,
      sensitivity: 'medium',
      noiseThreshold: 0.5,
      nightMode: false
    }
  };

  const mockBabyDocument = {
    _id: 'test-baby-id',
    userId: testUser.id,
    ...validBabyData,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeAll(async () => {
    // Initialize performance monitoring
    performance.mark('test-suite-start');
  });

  beforeEach(async () => {
    // Create testing module before each test
    module = await Test.createTestingModule({
      controllers: [BabyController],
      providers: [
        {
          provide: BabyService,
          useFactory: () => ({
            create: jest.fn(),
            findById: jest.fn(),
            updatePreferences: jest.fn(),
            deactivate: jest.fn(),
            getPatternStatistics: jest.fn()
          })
        }
      ]
    }).compile();

    controller = module.get<BabyController>(BabyController);
    service = module.get<BabyService>(BabyService) as jest.Mocked<BabyService>;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    performance.clearMarks();
  });

  afterAll(async () => {
    // Generate performance report
    performance.mark('test-suite-end');
    performance.measure('Test Suite Duration', 'test-suite-start', 'test-suite-end');
    await module.close();
  });

  describe('create', () => {
    it('should create a new baby profile with valid data', async () => {
      // Arrange
      const createDto = new CreateBabyDto();
      Object.assign(createDto, validBabyData);
      service.create.mockResolvedValue(mockBabyDocument);

      // Act
      const startTime = performance.now();
      const result = await controller.create(createDto, mockRequest);
      const endTime = performance.now();

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto, testUser.id);
      expect(result).toEqual(mockBabyDocument);
      expect(endTime - startTime).toBeLessThan(1000); // Performance check
    });

    it('should reject invalid baby data', async () => {
      // Arrange
      const invalidData = new CreateBabyDto();
      Object.assign(invalidData, { name: '', birthDate: 'invalid-date' });

      // Act & Assert
      await expect(controller.create(invalidData, mockRequest))
        .rejects
        .toThrow(HttpException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const createDto = new CreateBabyDto();
      Object.assign(createDto, validBabyData);
      service.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.create(createDto, mockRequest))
        .rejects
        .toThrow(HttpException);
      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all active baby profiles for user', async () => {
      // Arrange
      const mockBabies = [mockBabyDocument];
      service.findById.mockResolvedValue(mockBabies);

      // Act
      const result = await controller.findAll(mockRequest);

      // Assert
      expect(service.findById).toHaveBeenCalledWith(testUser.id, undefined);
      expect(result).toEqual(mockBabies);
    });

    it('should apply isActive filter when provided', async () => {
      // Arrange
      service.findById.mockResolvedValue([mockBabyDocument]);

      // Act
      await controller.findAll(mockRequest, true);

      // Assert
      expect(service.findById).toHaveBeenCalledWith(testUser.id, true);
    });

    it('should handle empty result set', async () => {
      // Arrange
      service.findById.mockResolvedValue([]);

      // Act
      const result = await controller.findAll(mockRequest);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a specific baby profile', async () => {
      // Arrange
      service.findById.mockResolvedValue(mockBabyDocument);

      // Act
      const result = await controller.findOne('test-baby-id', mockRequest);

      // Assert
      expect(service.findById).toHaveBeenCalledWith('test-baby-id', testUser.id);
      expect(result).toEqual(mockBabyDocument);
    });

    it('should throw not found for non-existent profile', async () => {
      // Arrange
      service.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findOne('non-existent-id', mockRequest))
        .rejects
        .toThrow(HttpException);
      expect(service.findById).toHaveBeenCalled();
    });

    it('should validate UUID format', async () => {
      // Act & Assert
      await expect(controller.findOne('invalid-uuid', mockRequest))
        .rejects
        .toThrow();
    });
  });

  describe('update', () => {
    it('should update baby profile with valid data', async () => {
      // Arrange
      const updateDto = new UpdateBabyDto();
      Object.assign(updateDto, { name: 'Updated Name' });
      service.updatePreferences.mockResolvedValue({
        ...mockBabyDocument,
        name: 'Updated Name'
      });

      // Act
      const result = await controller.update('test-baby-id', updateDto, mockRequest);

      // Assert
      expect(service.updatePreferences).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should validate partial updates', async () => {
      // Arrange
      const updateDto = new UpdateBabyDto();
      Object.assign(updateDto, { preferences: { sensitivity: 'high' } });

      // Act
      await controller.update('test-baby-id', updateDto, mockRequest);

      // Assert
      expect(service.updatePreferences).toHaveBeenCalledWith(
        'test-baby-id',
        expect.objectContaining({ preferences: { sensitivity: 'high' } })
      );
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidDto = new UpdateBabyDto();
      Object.assign(invalidDto, { name: '' });

      // Act & Assert
      await expect(controller.update('test-baby-id', invalidDto, mockRequest))
        .rejects
        .toThrow(HttpException);
    });
  });

  describe('remove', () => {
    it('should deactivate baby profile', async () => {
      // Arrange
      service.deactivate.mockResolvedValue(undefined);

      // Act
      await controller.remove('test-baby-id', mockRequest);

      // Assert
      expect(service.deactivate).toHaveBeenCalledWith('test-baby-id', testUser.id);
    });

    it('should handle non-existent profile', async () => {
      // Arrange
      service.deactivate.mockRejectedValue(new Error('Profile not found'));

      // Act & Assert
      await expect(controller.remove('non-existent-id', mockRequest))
        .rejects
        .toThrow(HttpException);
    });
  });

  describe('getStatistics', () => {
    it('should return pattern statistics', async () => {
      // Arrange
      const mockStats = {
        totalPatterns: 100,
        needTypeDistribution: { HUNGER: 40, SLEEP: 30, PAIN: 20, DISCOMFORT: 10 },
        learningProgress: 85,
        averageConfidence: 0.92
      };
      service.getPatternStatistics.mockResolvedValue(mockStats);

      // Act
      const result = await controller.getStatistics('test-baby-id', mockRequest);

      // Assert
      expect(service.getPatternStatistics).toHaveBeenCalledWith('test-baby-id');
      expect(result).toEqual(mockStats);
    });

    it('should handle empty statistics', async () => {
      // Arrange
      service.getPatternStatistics.mockResolvedValue({
        totalPatterns: 0,
        needTypeDistribution: {},
        learningProgress: 0,
        averageConfidence: 0
      });

      // Act
      const result = await controller.getStatistics('test-baby-id', mockRequest);

      // Assert
      expect(result.totalPatterns).toBe(0);
    });
  });
});