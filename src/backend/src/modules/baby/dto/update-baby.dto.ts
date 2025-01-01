import { 
  IsString, 
  IsNotEmpty, 
  IsDate, 
  IsOptional, 
  IsObject,
  Length,
  MaxDate,
  ValidateNested
} from 'class-validator'; // ^0.14.0

import { ApiProperty, PartialType } from '@nestjs/swagger'; // ^5.0.0
import { Type } from 'class-transformer'; // ^0.14.0
import { IBaby } from '../schemas/baby.schema';
import { CreateBabyDto } from './create-baby.dto';

/**
 * Data Transfer Object for updating existing baby profiles
 * Extends CreateBabyDto as partial type to make all fields optional
 * while maintaining validation rules and type safety
 */
@PartialType(CreateBabyDto)
export class UpdateBabyDto implements Partial<Pick<IBaby, 'name' | 'birthDate' | 'preferences'>> {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters' })
  @ApiProperty({
    description: 'Baby\'s full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 50,
    required: false
  })
  name?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Birth date must be a valid date' })
  @IsNotEmpty({ message: 'Birth date cannot be empty' })
  @MaxDate(new Date(), { message: 'Birth date cannot be in the future' })
  @ApiProperty({
    description: 'Baby\'s date of birth',
    example: '2023-01-01',
    required: false,
    type: Date
  })
  birthDate?: Date;

  @IsOptional()
  @IsObject({ message: 'Preferences must be a valid object' })
  @ValidateNested()
  @Type(() => CreateBabyDto['preferences'])
  @ApiProperty({
    description: 'Optional monitoring preferences for the baby',
    type: 'object',
    required: false,
    example: {
      sensitivity: 'medium',
      backgroundMonitoring: false,
      notificationsEnabled: true,
      noiseThreshold: 0.5,
      nightMode: false
    }
  })
  preferences?: IBaby['preferences'];

  /**
   * Transforms the DTO to a safe object for update operation
   * Implements data minimization and sanitization
   * @returns Sanitized object for database update
   */
  toUpdateEntity(): Partial<IBaby> {
    const updateData: Partial<IBaby> = {};

    if (this.name !== undefined) {
      updateData.name = this.name.trim();
    }

    if (this.birthDate !== undefined) {
      updateData.birthDate = new Date(this.birthDate);
    }

    if (this.preferences !== undefined) {
      updateData.preferences = {
        ...this.preferences
      };
    }

    return updateData;
  }
}