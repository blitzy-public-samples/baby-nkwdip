import { 
  IsString, 
  IsNotEmpty, 
  IsDate, 
  IsOptional, 
  IsObject,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested
} from 'class-validator'; // ^0.14.0

import { Transform, Type } from 'class-transformer'; // ^0.14.0
import { IBaby } from '../schemas/baby.schema';

/**
 * DTO class for validating and transforming preferences data
 */
class PreferencesDto {
  @IsOptional()
  @IsString()
  sensitivity: 'low' | 'medium' | 'high' = 'medium';

  @IsOptional()
  @Transform(({ value }) => Boolean(value))
  backgroundMonitoring: boolean = false;

  @IsOptional()
  @Transform(({ value }) => Boolean(value))
  notificationsEnabled: boolean = true;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  noiseThreshold: number = 0.5;

  @IsOptional()
  @Transform(({ value }) => Boolean(value))
  nightMode: boolean = false;
}

/**
 * Data Transfer Object for creating new baby profiles
 * Implements comprehensive validation rules and data sanitization
 * Ensures COPPA and GDPR compliance through data minimization
 */
export class CreateBabyDto implements Pick<IBaby, 'name' | 'birthDate' | 'preferences'> {
  @IsString({ message: 'Name must be a valid string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name cannot exceed 50 characters' })
  @Matches(/^[a-zA-Z\s-']+$/, { 
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes' 
  })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Type(() => Date)
  @IsDate({ message: 'Birth date must be a valid date' })
  @IsNotEmpty({ message: 'Birth date is required' })
  @Transform(({ value }) => new Date(value))
  birthDate: Date;

  @IsOptional()
  @IsObject({ message: 'Preferences must be a valid object' })
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;

  /**
   * Validates that birth date is not in the future
   * @param birthDate The date to validate
   * @returns boolean indicating if date is valid
   */
  private isValidBirthDate(birthDate: Date): boolean {
    return birthDate <= new Date();
  }

  /**
   * Transforms the DTO to a safe object for storage
   * Implements data minimization for GDPR compliance
   * @returns Sanitized object for database storage
   */
  toEntity(): Partial<IBaby> {
    return {
      name: this.name,
      birthDate: this.birthDate,
      preferences: {
        ...new PreferencesDto(),
        ...this.preferences
      }
    };
  }
}