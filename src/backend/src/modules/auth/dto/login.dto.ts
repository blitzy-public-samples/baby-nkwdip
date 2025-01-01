import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'; // class-validator@0.14.0

/**
 * Data Transfer Object for validating login request payload
 * Implements comprehensive validation rules for authentication data
 * following security best practices and API design standards
 */
export class LoginDto {
  /**
   * User's email address
   * Must be a valid email format according to RFC 5322 standards
   * Required field that cannot be empty
   */
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsString({ message: 'Email must be a string' })
  email: string;

  /**
   * User's password
   * Must meet minimum security requirements:
   * - At least 8 characters long
   * - Cannot be empty
   * - Must be a string type
   */
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}