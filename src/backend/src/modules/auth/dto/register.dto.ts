import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from 'class-validator'; // v0.14.0

/**
 * Data Transfer Object for user registration in the Baby Cry Analyzer application.
 * Implements comprehensive validation rules using class-validator decorators to ensure
 * data integrity and security compliance with GDPR and HIPAA requirements.
 */
export class RegisterDto {
    /**
     * User's email address.
     * Must be a valid email format according to RFC standards.
     * Required field that cannot be empty.
     */
    @IsEmail({}, { message: 'Invalid email format. Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required and cannot be empty' })
    email: string;

    /**
     * User's password.
     * Must meet the following security requirements:
     * - Minimum 8 characters long
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one number
     * - At least one special character
     */
    @IsString({ message: 'Password must be a valid string' })
    @IsNotEmpty({ message: 'Password is required and cannot be empty' })
    @MinLength(8, { message: 'Password must be at least 8 characters long for security' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' }
    )
    password: string;

    /**
     * User's full name.
     * Must be at least 2 characters long.
     * Required field that cannot be empty.
     */
    @IsString({ message: 'Name must be a valid string' })
    @IsNotEmpty({ message: 'Name is required and cannot be empty' })
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    name: string;
}