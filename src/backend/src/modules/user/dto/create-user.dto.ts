import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from 'class-validator'; // class-validator@0.14.0

/**
 * Data Transfer Object (DTO) for user creation requests in the Baby Cry Analyzer application.
 * Implements comprehensive validation rules for user registration data, ensuring data integrity
 * and security compliance with GDPR and HIPAA standards.
 */
export class CreateUserDto {
    /**
     * User's email address.
     * Must be a valid email format according to RFC 5322 standards.
     */
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    /**
     * User's password.
     * Must meet the following security requirements:
     * - Minimum 8 characters
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one number
     */
    @IsString({ message: 'Password must be a string' })
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,
        { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }
    )
    password: string;

    /**
     * User's full name.
     * Required for user identification and personalization.
     */
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    name: string;
}