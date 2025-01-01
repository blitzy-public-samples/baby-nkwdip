import { IsEmail, IsString, IsOptional, MinLength, Matches } from 'class-validator'; // ^0.14.0
import { PartialType } from '@nestjs/swagger'; // ^6.0.0

/**
 * Data Transfer Object (DTO) for validating partial user profile updates
 * Implements comprehensive validation rules with detailed error messages
 * Ensures PII protection and security compliance
 */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address that follows the correct format' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Password must be provided as a text string' })
  @MinLength(8, { message: 'Password must contain at least 8 characters for security' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,
    { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number for enhanced security' }
  )
  password?: string;

  @IsOptional()
  @IsString({ message: 'Name must be provided as a text string' })
  name?: string;
}