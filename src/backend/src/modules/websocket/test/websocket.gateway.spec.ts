import { Test, TestingModule } from '@nestjs/testing'; // ^9.0.0
import { Socket, Server } from 'socket.io'; // ^4.5.0
import { performance } from 'performance-now'; // ^2.1.0
import { WebSocketGateway } from '../websocket.gateway';
import { AnalysisService } from '../../analysis/analysis.service';
import { MLService } from '../../ml/ml.service';
import { NeedType } from '../../analysis/interfaces/analysis.interface';
import { IAuthenticatedSocket, ISocketEvents } from '../interfaces/socket.interface';

describe('WebSocketGateway', () => {
  let gateway: WebSocketGateway;
  let mockSocket: Partial<IAuthenticatedSocket>;
  let mockServer: Partial<Server>;
  let mockAnalysisService: Partial<AnalysisService>;
  let mockMLService: Partial<MLService>;
  let module: TestingModule;

  // Performance metrics tracking
  const performanceMetrics = {
    connectionTimes: [] as number[],
    processingTimes: [] as number[],
    memoryUsage: [] as number[],
    totalTests: 0,
    failedTests: 0
  };

  beforeEach(async () => {
    // Initialize mock socket with authentication
    mockSocket = {
      id: 'test-socket-id',
      handshake: {
        address: '127.0.0.1',
        auth: {
          token: 'valid-jwt-token'
        }
      },
      user: {
        sub: 'test-user-id',
        email: 'test@example.com',
        roles: ['Parent'],
        iat: Date.now() / 1000,
        exp: (Date.now() + 3600000) / 1000
      },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn()
    } as Partial<IAuthenticatedSocket>;

    // Initialize mock server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as Partial<Server>;

    // Initialize mock analysis service
    mockAnalysisService = {
      analyzeAudio: jest.fn().mockImplementation(async (audioData) => ({
        needType: NeedType.HUNGER,
        confidence: 0.95,
        features: {
          amplitude: -20,
          frequency: 400,
          duration: 2.5,
          pattern: 'PATTERN-1',
          noiseLevel: 30,
          signalToNoise: 15,
          harmonics: [800, 1200],
          energyDistribution: { low: 0.3, mid: 0.5, high: 0.2 }
        }
      }))
    };

    // Initialize mock ML service
    mockMLService = {
      analyzeCry: jest.fn().mockImplementation(async (audioData, sampleRate) => ({
        needType: NeedType.HUNGER,
        confidence: 0.95,
        latency: 50,
        features: {
          amplitude: -20,
          frequency: 400,
          harmonics: [800, 1200]
        }
      }))
    };

    // Create testing module
    module = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        {
          provide: AnalysisService,
          useValue: mockAnalysisService
        },
        {
          provide: MLService,
          useValue: mockMLService
        }
      ]
    }).compile();

    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    (gateway as any).server = mockServer;
  });

  afterEach(async () => {
    // Update performance metrics
    performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);
    performanceMetrics.totalTests++;
    
    // Cleanup
    jest.clearAllMocks();
    await module.close();
  });

  describe('handleConnection', () => {
    it('should successfully handle new socket connection', async () => {
      const startTime = performance();
      
      await gateway.handleConnection(mockSocket as IAuthenticatedSocket);
      
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
      expect((gateway as any).connectionStates.get(mockSocket.id)).toBeDefined();
      expect((gateway as any).connectionStates.get(mockSocket.id)).toMatchObject({
        ip: '127.0.0.1',
        isMonitoring: false,
        babyId: null
      });

      performanceMetrics.connectionTimes.push(performance() - startTime);
    });

    it('should reject connection when IP limit exceeded', async () => {
      // Setup multiple connections from same IP
      for (let i = 0; i < 3; i++) {
        const socket = {
          ...mockSocket,
          id: `test-socket-${i}`,
          handshake: { address: '127.0.0.1' }
        };
        await gateway.handleConnection(socket as IAuthenticatedSocket);
      }

      const newSocket = {
        ...mockSocket,
        id: 'test-socket-4',
        handshake: { address: '127.0.0.1' }
      };

      await gateway.handleConnection(newSocket as IAuthenticatedSocket);
      expect(newSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('startMonitoring', () => {
    const monitoringPayload: ISocketEvents['startMonitoring']['payload'] = {
      babyId: 'test-baby-id',
      timestamp: Date.now(),
      settings: {
        sensitivity: 80,
        noiseFilter: true
      }
    };

    it('should successfully start monitoring session', async () => {
      await gateway.handleConnection(mockSocket as IAuthenticatedSocket);
      
      const response = await gateway.handleStartMonitoring(
        mockSocket as IAuthenticatedSocket,
        monitoringPayload
      );

      expect(response.success).toBe(true);
      expect(response.sessionId).toBeDefined();
      expect(mockSocket.join).toHaveBeenCalledWith(`baby:${monitoringPayload.babyId}`);
      
      const state = (gateway as any).connectionStates.get(mockSocket.id);
      expect(state.isMonitoring).toBe(true);
      expect(state.babyId).toBe(monitoringPayload.babyId);
    });

    it('should reject monitoring start without valid connection', async () => {
      await expect(
        gateway.handleStartMonitoring(
          mockSocket as IAuthenticatedSocket,
          monitoringPayload
        )
      ).rejects.toThrow('Invalid connection state');
    });
  });

  describe('handleAudioData', () => {
    const audioPayload: ISocketEvents['audioData']['payload'] = {
      babyId: 'test-baby-id',
      sessionId: 'test-session-id',
      data: new Uint8Array(1024),
      timestamp: Date.now(),
      sequence: 1,
      metadata: {
        sampleRate: 44100,
        channels: 1,
        format: 'wav'
      }
    };

    it('should process audio data and return analysis', async () => {
      const startTime = performance();

      await gateway.handleConnection(mockSocket as IAuthenticatedSocket);
      await gateway.handleStartMonitoring(
        mockSocket as IAuthenticatedSocket,
        {
          babyId: audioPayload.babyId,
          timestamp: Date.now(),
          settings: { sensitivity: 80, noiseFilter: true }
        }
      );

      const response = await gateway.handleAudioData(
        mockSocket as IAuthenticatedSocket,
        audioPayload
      );

      expect(response.success).toBe(true);
      expect(response.sequence).toBe(audioPayload.sequence);
      expect(mockMLService.analyzeCry).toHaveBeenCalled();

      performanceMetrics.processingTimes.push(performance() - startTime);
    });

    it('should emit cry detection when confidence threshold met', async () => {
      await gateway.handleConnection(mockSocket as IAuthenticatedSocket);
      await gateway.handleStartMonitoring(
        mockSocket as IAuthenticatedSocket,
        {
          babyId: audioPayload.babyId,
          timestamp: Date.now(),
          settings: { sensitivity: 80, noiseFilter: true }
        }
      );

      // Fill batch buffer
      for (let i = 0; i < 5; i++) {
        await gateway.handleAudioData(
          mockSocket as IAuthenticatedSocket,
          {
            ...audioPayload,
            sequence: i
          }
        );
      }

      expect(mockServer.to).toHaveBeenCalledWith(`baby:${audioPayload.babyId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('cryDetected', expect.any(Object));
    });

    it('should reject audio data without active monitoring', async () => {
      await gateway.handleConnection(mockSocket as IAuthenticatedSocket);

      await expect(
        gateway.handleAudioData(mockSocket as IAuthenticatedSocket, audioPayload)
      ).rejects.toThrow('Invalid monitoring state');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should maintain acceptable processing times', () => {
      const avgProcessingTime = performanceMetrics.processingTimes.reduce((a, b) => a + b, 0) / 
        performanceMetrics.processingTimes.length;
      expect(avgProcessingTime).toBeLessThan(100); // 100ms threshold
    });

    it('should maintain stable memory usage', () => {
      const memoryGrowth = performanceMetrics.memoryUsage[performanceMetrics.memoryUsage.length - 1] -
        performanceMetrics.memoryUsage[0];
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB threshold
    });
  });
});