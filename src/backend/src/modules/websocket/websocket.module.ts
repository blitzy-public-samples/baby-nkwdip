import { Module } from '@nestjs/common'; // ^9.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^4.0.0
import { PrometheusModule } from '@willsoto/nestjs-prometheus'; // ^5.0.0

import { WebSocketGateway } from './websocket.gateway';
import { AnalysisModule } from '../analysis/analysis.module';
import { MLModule } from '../ml/ml.module';

/**
 * WebSocketModule provides real-time audio streaming and analysis capabilities
 * with advanced features including compression, GPU acceleration, batched processing,
 * security controls, and comprehensive monitoring.
 *
 * Key features:
 * - Real-time audio streaming with compression
 * - GPU-accelerated analysis processing
 * - Batched data handling for performance
 * - Rate limiting and security controls
 * - Comprehensive metrics collection
 * - Auto-scaling support
 */
@Module({
  imports: [
    // Import analysis capabilities
    AnalysisModule,
    
    // Import ML services for real-time processing
    MLModule,
    
    // Configure rate limiting
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 100 // Maximum requests per window
    }),
    
    // Configure metrics collection
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'babycry_websocket_'
        }
      },
      path: '/metrics'
    })
  ],
  
  providers: [
    // WebSocket gateway for real-time communication
    WebSocketGateway,
    
    // Additional providers from imported modules are automatically included
    // - BatchProcessor from AnalysisModule
    // - GPUAccelerator from MLModule
  ],
  
  exports: [
    // Export WebSocket gateway for use in other modules
    WebSocketGateway
  ]
})
export class WebSocketModule {}