import { 
    Controller, 
    Post, 
    Get, 
    Delete, 
    Body, 
    Param, 
    UseGuards, 
    Query, 
    UsePipes, 
    ValidationPipe,
    HttpStatus,
    ParseUUIDPipe,
    HttpException
} from '@nestjs/common'; // v9.0.0
import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiBody, 
    ApiQuery, 
    ApiSecurity,
    ApiParam
} from '@nestjs/swagger'; // v6.0.0
import { JwtAuthGuard } from '@nestjs/jwt'; // v9.0.0
import { AnalysisService } from './analysis.service';
import { AnalyzeAudioDto } from './dto/analyze-audio.dto';
import { AnalysisResultDto } from './dto/analysis-result.dto';
import { NeedType } from './interfaces/analysis.interface';

@Controller('analysis')
@ApiTags('analysis')
@ApiSecurity('jwt')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class AnalysisController {
    constructor(private readonly analysisService: AnalysisService) {}

    @Post()
    @ApiOperation({ 
        summary: 'Analyze baby cry audio',
        description: 'Processes audio data to determine baby needs with real-time analysis'
    })
    @ApiBody({ type: AnalyzeAudioDto })
    @ApiResponse({ 
        status: HttpStatus.CREATED, 
        description: 'Analysis completed successfully',
        type: AnalysisResultDto 
    })
    @ApiResponse({ 
        status: HttpStatus.BAD_REQUEST, 
        description: 'Invalid audio data or parameters' 
    })
    @ApiResponse({ 
        status: HttpStatus.UNAUTHORIZED, 
        description: 'Unauthorized access' 
    })
    async analyzeAudio(
        @Body() analyzeAudioDto: AnalyzeAudioDto
    ): Promise<AnalysisResultDto> {
        try {
            const audioData = new Float32Array(analyzeAudioDto.audioData);
            return await this.analysisService.analyzeAudio({
                data: audioData,
                sampleRate: 16000, // Standard sample rate for analysis
                babyId: analyzeAudioDto.babyId
            });
        } catch (error) {
            throw new HttpException(
                'Audio analysis failed: ' + error.message,
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get('history')
    @ApiOperation({ 
        summary: 'Get analysis history',
        description: 'Retrieves paginated cry analysis history with filtering options'
    })
    @ApiQuery({ name: 'babyId', required: true, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, default: 10 })
    @ApiQuery({ name: 'startDate', required: false, type: Date })
    @ApiQuery({ name: 'endDate', required: false, type: Date })
    @ApiQuery({ name: 'needType', required: false, enum: NeedType })
    @ApiQuery({ name: 'minConfidence', required: false, type: Number })
    @ApiResponse({ 
        status: HttpStatus.OK, 
        description: 'Analysis history retrieved successfully',
        type: [AnalysisResultDto]
    })
    async getAnalysisHistory(
        @Query('babyId', ParseUUIDPipe) babyId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate?: Date,
        @Query('endDate') endDate?: Date,
        @Query('needType') needType?: NeedType,
        @Query('minConfidence') minConfidence?: number
    ) {
        try {
            return await this.analysisService.getAnalysisHistory(babyId, {
                page,
                limit,
                startDate,
                endDate,
                needType,
                minConfidence
            });
        } catch (error) {
            throw new HttpException(
                'Failed to retrieve analysis history: ' + error.message,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('metrics/:babyId')
    @ApiOperation({ 
        summary: 'Get analysis metrics',
        description: 'Retrieves aggregated analysis metrics and statistics'
    })
    @ApiParam({ name: 'babyId', type: String })
    @ApiResponse({ 
        status: HttpStatus.OK, 
        description: 'Analysis metrics retrieved successfully' 
    })
    async getAnalysisMetrics(
        @Param('babyId', ParseUUIDPipe) babyId: string
    ) {
        try {
            return await this.analysisService.getAnalysisMetrics(babyId);
        } catch (error) {
            throw new HttpException(
                'Failed to retrieve analysis metrics: ' + error.message,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(':id')
    @ApiOperation({ 
        summary: 'Delete analysis record',
        description: 'Permanently removes an analysis record'
    })
    @ApiParam({ name: 'id', type: String })
    @ApiResponse({ 
        status: HttpStatus.NO_CONTENT, 
        description: 'Analysis record deleted successfully' 
    })
    async deleteAnalysis(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        try {
            await this.analysisService.deleteAnalysis(id);
        } catch (error) {
            throw new HttpException(
                'Failed to delete analysis: ' + error.message,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('batch')
    @ApiOperation({ 
        summary: 'Batch analyze audio files',
        description: 'Processes multiple audio files in batch for efficient analysis'
    })
    @ApiBody({ type: [AnalyzeAudioDto] })
    @ApiResponse({ 
        status: HttpStatus.CREATED, 
        description: 'Batch analysis completed successfully',
        type: [AnalysisResultDto]
    })
    async batchAnalyzeAudio(
        @Body() analyzeAudioDtos: AnalyzeAudioDto[]
    ): Promise<AnalysisResultDto[]> {
        try {
            const audioDataArray = analyzeAudioDtos.map(dto => ({
                data: new Float32Array(dto.audioData),
                sampleRate: 16000,
                babyId: dto.babyId
            }));
            return await this.analysisService.batchAnalyzeAudio(audioDataArray);
        } catch (error) {
            throw new HttpException(
                'Batch analysis failed: ' + error.message,
                HttpStatus.BAD_REQUEST
            );
        }
    }
}