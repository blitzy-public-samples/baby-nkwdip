import { IsString, IsUUID, IsOptional, IsObject, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for validating and transferring audio analysis request data.
 * Implements comprehensive validation rules and documentation for real-time audio
 * processing and pattern recognition capabilities.
 */
export class AnalyzeAudioDto {
  /**
   * Unique identifier of the baby whose audio is being analyzed.
   * Used for tracking and associating analysis results with specific profiles.
   */
  @ApiProperty({
    description: 'Unique identifier of the baby for analysis tracking',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true
  })
  @IsUUID('4', { message: 'Baby ID must be a valid UUIDv4' })
  readonly babyId: string;

  /**
   * Raw audio data buffer containing the cry recording for analysis.
   * Maximum size limited to 5MB to ensure optimal processing performance.
   */
  @ApiProperty({
    description: 'Raw audio data buffer for real-time analysis',
    type: 'string',
    format: 'binary',
    required: true,
    maxLength: 5242880 // 5MB limit
  })
  @IsString({ message: 'Audio data must be a valid binary string' })
  readonly audioData: Buffer;

  /**
   * ISO8601 timestamp indicating when the audio was recorded.
   * Used for temporal analysis and pattern correlation.
   */
  @ApiProperty({
    description: 'ISO8601 timestamp of audio recording for temporal analysis',
    example: '2023-01-01T00:00:00.000Z',
    required: false
  })
  @IsISO8601({ strict: true, strictSeparator: true }, 
    { message: 'Timestamp must be a valid ISO8601 date-time string' })
  @IsOptional()
  readonly timestamp?: string;

  /**
   * Additional contextual metadata to enhance pattern recognition accuracy.
   * Includes environmental factors and device information.
   */
  @ApiProperty({
    description: 'Additional contextual metadata for enhanced pattern recognition',
    example: {
      environment: 'quiet',
      duration: 30,
      noiseLevel: 'low',
      deviceType: 'iOS',
      appVersion: '1.0.0'
    },
    required: false,
    type: 'object'
  })
  @IsObject({ message: 'Metadata must be a valid JSON object' })
  @IsOptional()
  readonly metadata?: Record<string, any>;
}