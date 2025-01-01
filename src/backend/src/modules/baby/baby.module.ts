import { Module } from '@nestjs/common'; // v9.0.0
import { MongooseModule } from '@nestjs/mongoose'; // v9.0.0
import { CacheModule } from '@nestjs/cache-manager'; // v1.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // v4.0.0

import { BabyController } from './baby.controller';
import { BabyService } from './baby.service';
import { Baby, BabySchema } from './schemas/baby.schema';
import { MLService } from '../ml/ml.service';

/**
 * Enhanced BabyModule that configures baby profile management functionality
 * with comprehensive security, caching and performance optimizations
 */
@Module({
  imports: [
    // Configure MongoDB with enhanced schema options
    MongooseModule.forFeatureAsync([
      {
        name: Baby.name,
        useFactory: () => {
          const schema = BabySchema;

          // Enable timestamps for auditing
          schema.set('timestamps', true);

          // Configure indexes for performance
          schema.index({ userId: 1, isActive: 1 });
          schema.index({ birthDate: 1 });
          schema.index({ retentionDate: 1 });
          schema.index({ 'patternHistory.lastUpdate': 1 });
          schema.index({ name: 'text' });

          // Add compound index for efficient queries
          schema.index({ 
            userId: 1, 
            isActive: 1, 
            retentionDate: 1 
          });

          return schema;
        }
      }
    ]),

    // Configure caching for performance optimization
    CacheModule.register({
      ttl: 60, // Cache TTL in seconds
      max: 100, // Maximum number of items in cache
      isGlobal: false // Scope cache to this module
    }),

    // Configure rate limiting for security
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 30 // Maximum number of requests per window
    })
  ],
  controllers: [BabyController],
  providers: [
    BabyService,
    MLService
  ],
  exports: [BabyService] // Export service for use in other modules
})
export class BabyModule {
  constructor() {
    // Module initialization logging could be added here
  }
}