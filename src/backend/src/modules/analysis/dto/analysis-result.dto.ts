// @package class-validator ^0.14.0
// @package class-transformer ^0.5.0

import { 
    IsString, 
    IsEnum, 
    IsNumber, 
    IsDate, 
    IsObject,
    Min, 
    Max, 
    IsUUID,
    ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { NeedType } from '../interfaces/analysis.interface';

/**
 * DTO for validating and transferring audio analysis features
 * with comprehensive range validation to ensure data quality
 */
export class AnalysisFeaturesDto {
    @IsNumber()
    @Min(0)
    @Max(100)
    amplitude: number;

    @IsNumber()
    @Min(20)
    @Max(20000)
    frequency: number;

    @IsNumber()
    @Min(0.1)
    @Max(30)
    duration: number;

    @IsString()
    pattern: string;

    @IsNumber()
    @Min(0)
    @Max(100)
    noiseLevel: number;
}

/**
 * DTO for validating and transferring complete cry analysis results
 * Implements strict validation rules to support >90% classification accuracy
 * through comprehensive data integrity checks
 */
export class AnalysisResultDto {
    @IsUUID(4)
    id: string;

    @IsUUID(4)
    babyId: string;

    @IsEnum(NeedType)
    needType: NeedType;

    @IsNumber()
    @Min(0)
    @Max(100)
    confidence: number;

    @ValidateNested()
    @Type(() => AnalysisFeaturesDto)
    features: AnalysisFeaturesDto;

    @IsDate()
    @Type(() => Date)
    timestamp: Date;
}