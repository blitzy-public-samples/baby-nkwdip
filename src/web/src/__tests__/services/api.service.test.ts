import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals'; // ^29.0.0
import MockAdapter from 'axios-mock-adapter'; // ^1.21.0
import { io, Socket } from 'socket.io-client'; // ^4.6.0
import { ApiService } from '../../services/api.service';
import { AudioAnalysisResult, AudioFeatures, AudioState } from '../../types/audio.types';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('ApiService', () => {
  let apiService: ApiService;
  let mockAxios: MockAdapter;
  let mockSocket: jest.Mocked<Socket>;
  
  const TEST_CONFIG = {
    baseUrl: 'https://test-api.example.com',
    apiKey: 'test-api-key'
  };

  const MOCK_AUTH_RESPONSE = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600
  };

  const MOCK_AUDIO_FEATURES: AudioFeatures = {
    amplitude: [0.5, 0.6, 0.7],
    frequency: [440, 880, 1320],
    noiseLevel: 0.1,
    spectralCentroid: 650,
    mfcc: [1.2, -0.8, 0.5],
    zeroCrossingRate: 0.15
  };

  const MOCK_ANALYSIS_RESULT: AudioAnalysisResult = {
    needType: 'hunger',
    confidence: 0.95,
    features: MOCK_AUDIO_FEATURES,
    timestamp: Date.now(),
    reliability: 0.92,
    alternativeNeedTypes: ['tiredness', 'discomfort'],
    analysisMetadata: { processingTime: 150 }
  };

  beforeEach(() => {
    // Initialize API service
    apiService = new ApiService(TEST_CONFIG.baseUrl, TEST_CONFIG.apiKey);
    
    // Setup axios mock
    mockAxios = new MockAdapter(apiService['httpClient']);
    
    // Setup socket mock
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connect: jest.fn(),
    } as unknown as jest.Mocked<Socket>;
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  afterEach(() => {
    mockAxios.reset();
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    test('should successfully login with valid credentials', async () => {
      mockAxios.onPost('/auth/login').reply(200, MOCK_AUTH_RESPONSE);

      const result = await apiService.login('test@example.com', 'password123');

      expect(result).toEqual(MOCK_AUTH_RESPONSE);
      expect(mockAxios.history.post[0].data).toEqual(
        JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      );
    });

    test('should handle login failure with invalid credentials', async () => {
      mockAxios.onPost('/auth/login').reply(401, { error: 'Invalid credentials' });

      await expect(apiService.login('invalid@example.com', 'wrongpass'))
        .rejects.toThrow();
    });

    test('should handle token rotation', async () => {
      mockAxios.onPost('/auth/rotate-token').reply(200, {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      });

      // Trigger token rotation
      jest.advanceTimersByTime(300000); // 5 minutes

      expect(mockAxios.history.post).toContainEqual(
        expect.objectContaining({ url: '/auth/rotate-token' })
      );
    });
  });

  describe('Audio Analysis', () => {
    test('should successfully analyze audio data', async () => {
      const mockAudioBlob = new Blob(['mock-audio-data'], { type: 'audio/wav' });
      mockAxios.onPost('/analysis/audio').reply(200, MOCK_ANALYSIS_RESULT);

      const result = await apiService.analyzeAudio(mockAudioBlob);

      expect(result).toEqual(MOCK_ANALYSIS_RESULT);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should handle invalid audio data', async () => {
      const invalidBlob = new Blob([], { type: 'invalid/type' });
      mockAxios.onPost('/analysis/audio').reply(400, { error: 'Invalid audio format' });

      await expect(apiService.analyzeAudio(invalidBlob)).rejects.toThrow();
    });

    test('should respect rate limiting', async () => {
      const mockAudioBlob = new Blob(['mock-audio-data'], { type: 'audio/wav' });
      
      // Simulate rate limit exceeded
      for (let i = 0; i < 101; i++) {
        if (i < 100) {
          mockAxios.onPost('/analysis/audio').reply(200, MOCK_ANALYSIS_RESULT);
        } else {
          mockAxios.onPost('/analysis/audio').reply(429, { error: 'Rate limit exceeded' });
        }
        
        if (i === 100) {
          await expect(apiService.analyzeAudio(mockAudioBlob)).rejects.toThrow('Rate limit exceeded');
        } else {
          await apiService.analyzeAudio(mockAudioBlob);
        }
      }
    });
  });

  describe('Real-time Monitoring', () => {
    test('should establish WebSocket connection', async () => {
      await apiService.startMonitoring('baby-123');

      expect(io).toHaveBeenCalledWith(TEST_CONFIG.baseUrl, expect.objectContaining({
        transports: ['websocket'],
        reconnectionAttempts: 5
      }));
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('analysis_update', expect.any(Function));
    });

    test('should handle WebSocket disconnection', async () => {
      await apiService.startMonitoring('baby-123');

      // Simulate disconnect event
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      
      if (disconnectHandler) {
        disconnectHandler();
        expect(apiService['connectionState'].isConnected).toBeFalsy();
      }
    });

    test('should handle WebSocket errors', async () => {
      await apiService.startMonitoring('baby-123');

      // Simulate error event
      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        errorHandler(new Error('WebSocket error'));
        // Verify error handling behavior
        expect(apiService['connectionState'].reconnectionAttempts).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Security Measures', () => {
    test('should include security headers in requests', async () => {
      mockAxios.onPost('/analysis/audio').reply(200, MOCK_ANALYSIS_RESULT);
      
      await apiService.analyzeAudio(new Blob(['test'], { type: 'audio/wav' }));
      
      const request = mockAxios.history.post[0];
      expect(request.headers).toMatchObject({
        'X-API-Key': TEST_CONFIG.apiKey,
        'X-Request-ID': expect.any(String),
        'X-Timestamp': expect.any(String)
      });
    });

    test('should sanitize input data', async () => {
      mockAxios.onPost('/auth/login').reply(200, MOCK_AUTH_RESPONSE);
      
      await apiService.login('test@example.com<script>', 'password123');
      
      const request = JSON.parse(mockAxios.history.post[0].data);
      expect(request.email).not.toContain('<script>');
    });

    test('should validate analysis results', async () => {
      const invalidResult = { ...MOCK_ANALYSIS_RESULT, confidence: 1.5 };
      mockAxios.onPost('/analysis/audio').reply(200, invalidResult);

      const result = await apiService.analyzeAudio(new Blob(['test'], { type: 'audio/wav' }));
      
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      mockAxios.onPost('/analysis/audio').networkError();
      
      await expect(apiService.analyzeAudio(new Blob(['test'], { type: 'audio/wav' })))
        .rejects.toThrow();
    });

    test('should handle timeout errors', async () => {
      mockAxios.onPost('/analysis/audio').timeout();
      
      await expect(apiService.analyzeAudio(new Blob(['test'], { type: 'audio/wav' })))
        .rejects.toThrow();
    });

    test('should handle server errors', async () => {
      mockAxios.onPost('/analysis/audio').reply(500, { error: 'Internal server error' });
      
      await expect(apiService.analyzeAudio(new Blob(['test'], { type: 'audio/wav' })))
        .rejects.toThrow();
    });
  });
});