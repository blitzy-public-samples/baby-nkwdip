import { Socket } from 'socket.io'; // ^4.5.0
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

/**
 * Interface extending Socket.IO socket with authentication and monitoring state.
 * Provides type safety for authenticated WebSocket connections with enhanced state tracking.
 *
 * @interface IAuthenticatedSocket
 * @extends {Socket}
 */
export interface IAuthenticatedSocket extends Socket {
  /**
   * Authenticated user information from JWT token
   */
  user: JwtPayload;

  /**
   * Currently monitored baby ID, null if not monitoring
   */
  babyId: string | null;

  /**
   * Flag indicating if socket is currently in monitoring mode
   */
  isMonitoring: boolean;

  /**
   * Timestamp of last activity on this socket (Unix timestamp in ms)
   */
  lastActivity: number;

  /**
   * Initial socket connection timestamp (Unix timestamp in ms)
   */
  connectionTimestamp: number;
}

/**
 * Interface defining all available WebSocket events and their payload types.
 * Provides type safety and documentation for real-time communication.
 *
 * @interface ISocketEvents
 */
export interface ISocketEvents {
  /**
   * Event to start baby monitoring session
   */
  startMonitoring: {
    payload: {
      babyId: string;
      timestamp: number;
      settings: {
        sensitivity: number;  // 0-100 scale
        noiseFilter: boolean;
      };
    };
    response: {
      success: boolean;
      message: string;
      sessionId: string;
      timestamp: number;
    };
  };

  /**
   * Event to stop baby monitoring session
   */
  stopMonitoring: {
    payload: {
      babyId: string;
      sessionId: string;
      timestamp: number;
    };
    response: {
      success: boolean;
      message: string;
      timestamp: number;
      sessionDuration: number;  // Duration in milliseconds
    };
  };

  /**
   * Event for sending audio data chunks for analysis
   */
  audioData: {
    payload: {
      babyId: string;
      sessionId: string;
      data: Uint8Array;
      timestamp: number;
      sequence: number;  // For maintaining order of audio chunks
      metadata: {
        sampleRate: number;
        channels: number;
        format: string;  // Audio format (e.g., 'wav', 'opus')
      };
    };
    response: {
      success: boolean;
      analysis: {
        needType: string;
        confidence: number;
        timestamp: number;
        features: Record<string, number>;
      };
      sequence: number;  // Echo back sequence for client synchronization
    };
  };

  /**
   * Event emitted when a cry is detected and analyzed
   */
  cryDetected: {
    payload: {
      babyId: string;
      sessionId: string;
      needType: string;
      confidence: number;
      timestamp: number;
      features: Record<string, number>;
      duration: number;  // Duration of cry in milliseconds
    };
  };

  /**
   * Event emitted when a connection error occurs
   */
  connectionError: {
    payload: {
      code: string;
      message: string;
      timestamp: number;
    };
  };
}