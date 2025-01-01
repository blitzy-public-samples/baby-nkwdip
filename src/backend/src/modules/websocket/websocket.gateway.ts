import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  ConnectedSocket 
} from '@nestjs/websockets'; // ^9.0.0
import { Server } from 'socket.io'; // ^4.5.0
import { UseGuards, Logger, Injectable, UseInterceptors } from '@nestjs/common'; // ^9.0.0
import { RateLimit } from '@nestjs/throttler'; // ^4.0.0
import { IAuthenticatedSocket, ISocketEvents, IMonitoringState } from './interfaces/socket.interface';
import { AnalysisService } from '../analysis/analysis.service';
import { MLService } from '../ml/ml.service';
import { WsJwtGuard } from '../../guards/ws-jwt.guard';
import { WsLoggingInterceptor } from '../../interceptors/ws-logging.interceptor';

// Constants for WebSocket configuration
const MONITORING_NAMESPACE = '/monitor';
const MIN_CONFIDENCE_THRESHOLD = 0.90;
const MAX_AUDIO_CHUNK_SIZE = 16384;
const BATCH_SIZE_THRESHOLD = 5;
const BATCH_TIMEOUT_MS = 100;
const MAX_CONNECTIONS_PER_IP = 3;
const HEARTBEAT_INTERVAL_MS = 30000;

@WebSocketGateway({ 
  cors: true, 
  namespace: MONITORING_NAMESPACE, 
  transports: ['websocket'],
  compression: true 
})
@Injectable()
@UseInterceptors(WsLoggingInterceptor)
export class WebSocketGateway {
  private readonly logger = new Logger(WebSocketGateway.name);
  @WebSocketServer() private server: Server;
  private readonly audioBatchBuffer: Map<string, Uint8Array[]> = new Map();
  private readonly connectionStates: Map<string, IMonitoringState> = new Map();
  private readonly performanceMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    avgProcessingTime: 0,
    lastUpdateTime: Date.now()
  };

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly mlService: MLService
  ) {
    this.setupHeartbeat();
    this.setupMetricsCollection();
  }

  @UseGuards(WsJwtGuard)
  @RateLimit({ ttl: 60, limit: 5 })
  async handleConnection(@ConnectedSocket() client: IAuthenticatedSocket): Promise<void> {
    try {
      // Validate connection limits
      const clientIp = client.handshake.address;
      const connectionsFromIp = Array.from(this.connectionStates.values())
        .filter(state => state.ip === clientIp).length;

      if (connectionsFromIp >= MAX_CONNECTIONS_PER_IP) {
        throw new Error('Connection limit exceeded for IP');
      }

      // Initialize connection state
      this.connectionStates.set(client.id, {
        ip: clientIp,
        isMonitoring: false,
        babyId: null,
        lastActivity: Date.now(),
        batchBuffer: [],
        metrics: {
          processedChunks: 0,
          avgProcessingTime: 0,
          detections: 0
        }
      });

      // Update metrics
      this.performanceMetrics.totalConnections++;
      this.performanceMetrics.activeConnections++;

      this.logger.log(`Client connected: ${client.id}`);

    } catch (error) {
      this.logger.error('Connection failed', { error, clientId: client.id });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('startMonitoring')
  @UseGuards(WsJwtGuard)
  async handleStartMonitoring(
    @ConnectedSocket() client: IAuthenticatedSocket,
    payload: ISocketEvents['startMonitoring']['payload']
  ): Promise<ISocketEvents['startMonitoring']['response']> {
    try {
      const state = this.connectionStates.get(client.id);
      if (!state) throw new Error('Invalid connection state');

      // Update monitoring state
      state.isMonitoring = true;
      state.babyId = payload.babyId;
      state.lastActivity = Date.now();

      // Join baby-specific room
      await client.join(`baby:${payload.babyId}`);

      return {
        success: true,
        message: 'Monitoring started successfully',
        sessionId: crypto.randomUUID(),
        timestamp: Date.now()
      };

    } catch (error) {
      this.logger.error('Start monitoring failed', { error, clientId: client.id });
      throw error;
    }
  }

  @SubscribeMessage('audioData')
  @RateLimit({ ttl: 1, limit: 30 })
  async handleAudioData(
    @ConnectedSocket() client: IAuthenticatedSocket,
    payload: ISocketEvents['audioData']['payload']
  ): Promise<ISocketEvents['audioData']['response']> {
    const startTime = performance.now();
    
    try {
      const state = this.connectionStates.get(client.id);
      if (!state || !state.isMonitoring) {
        throw new Error('Invalid monitoring state');
      }

      // Validate payload
      if (payload.data.length > MAX_AUDIO_CHUNK_SIZE) {
        throw new Error('Audio chunk size exceeds limit');
      }

      // Add to batch buffer
      let batchBuffer = this.audioBatchBuffer.get(client.id) || [];
      batchBuffer.push(payload.data);
      this.audioBatchBuffer.set(client.id, batchBuffer);

      // Process batch if threshold reached
      let analysis = null;
      if (batchBuffer.length >= BATCH_SIZE_THRESHOLD) {
        // Combine audio chunks
        const combinedData = this.combineBatchedAudio(batchBuffer);

        // Process with GPU acceleration
        analysis = await this.mlService.analyzeCryGPU(
          combinedData,
          payload.metadata.sampleRate
        );

        // Clear batch buffer
        this.audioBatchBuffer.delete(client.id);

        // Emit detection if confidence threshold met
        if (analysis.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          this.server.to(`baby:${payload.babyId}`).emit('cryDetected', {
            babyId: payload.babyId,
            sessionId: payload.sessionId,
            needType: analysis.needType,
            confidence: analysis.confidence,
            timestamp: Date.now(),
            features: analysis.features,
            duration: payload.metadata.duration
          });
          state.metrics.detections++;
        }
      }

      // Update metrics
      const processingTime = performance.now() - startTime;
      this.updateMetrics(state, processingTime);

      return {
        success: true,
        analysis: analysis || {
          needType: null,
          confidence: 0,
          timestamp: Date.now(),
          sequence: payload.sequence
        },
        sequence: payload.sequence
      };

    } catch (error) {
      this.logger.error('Audio processing failed', { 
        error, 
        clientId: client.id,
        sequence: payload.sequence 
      });
      throw error;
    }
  }

  private setupHeartbeat(): void {
    setInterval(() => {
      for (const [clientId, state] of this.connectionStates.entries()) {
        if (Date.now() - state.lastActivity > HEARTBEAT_INTERVAL_MS) {
          this.handleDisconnection(clientId);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private setupMetricsCollection(): void {
    setInterval(() => {
      this.logger.debug('WebSocket metrics', {
        ...this.performanceMetrics,
        connectionStates: this.connectionStates.size,
        batchBuffers: this.audioBatchBuffer.size
      });
    }, 60000); // Every minute
  }

  private handleDisconnection(clientId: string): void {
    const state = this.connectionStates.get(clientId);
    if (state) {
      this.connectionStates.delete(clientId);
      this.audioBatchBuffer.delete(clientId);
      this.performanceMetrics.activeConnections--;
    }
  }

  private combineBatchedAudio(chunks: Uint8Array[]): Float32Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combined.set(new Float32Array(chunk.buffer), offset);
      offset += chunk.length;
    }

    return combined;
  }

  private updateMetrics(state: IMonitoringState, processingTime: number): void {
    state.metrics.processedChunks++;
    state.metrics.avgProcessingTime = (
      state.metrics.avgProcessingTime * (state.metrics.processedChunks - 1) +
      processingTime
    ) / state.metrics.processedChunks;
    state.lastActivity = Date.now();
  }
}