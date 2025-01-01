import { Injectable, Logger } from '@nestjs/common'; // v9.0.0
import * as tf from '@tensorflow/tfjs-node'; // v4.2.0
import { IModelConfig, IModelTrainingConfig, IModelMetrics } from '../interfaces/model.interface';
import { NeedType } from '../../analysis/interfaces/analysis.interface';
import { FeatureExtractionService } from './feature-extraction.service';

// Constants for model training configuration
const DEFAULT_BATCH_SIZE = 32;
const DEFAULT_EPOCHS = 100;
const DEFAULT_LEARNING_RATE = 0.001;
const DEFAULT_VALIDATION_SPLIT = 0.2;
const MIN_ACCURACY_THRESHOLD = 0.9;
const MAX_TRAINING_TIME_DAYS = 14;
const CHECKPOINT_INTERVAL = 1800; // 30 minutes
const MAX_MEMORY_USAGE = 0.8; // 80% memory utilization threshold

@Injectable()
export class ModelTrainingService {
    private readonly logger = new Logger(ModelTrainingService.name);
    private model: tf.LayersModel | null = null;
    private modelRegistry: Map<string, IModelConfig> = new Map();
    private trainingMetrics: Map<string, IModelMetrics> = new Map();
    private resourceMonitor: NodeJS.Timer;
    private checkpointManager: tf.CheckpointManager;

    constructor(
        private readonly featureExtractionService: FeatureExtractionService
    ) {
        this.initializeEnvironment();
    }

    /**
     * Trains a new model or continues training with distributed support
     */
    async trainModel(
        trainingData: Float32Array[],
        labels: NeedType[],
        config: IModelTrainingConfig
    ): Promise<IModelMetrics> {
        const startTime = Date.now();
        try {
            // Validate training data and extract features
            const validatedData = await this.validateTrainingData(trainingData, labels);
            const features = await this.extractFeatures(validatedData.data);

            // Configure distributed training
            const strategy = await this.configureDistributedStrategy();
            
            // Initialize or load model
            await this.initializeModel(config);

            // Prepare data for training
            const { xs, ys } = this.prepareTrainingData(features, validatedData.labels);

            // Configure training parameters
            const trainConfig = this.configureTraining(config);

            // Execute distributed training
            const trainingResult = await this.executeDistributedTraining(
                strategy,
                xs,
                ys,
                trainConfig
            );

            // Validate model performance
            const metrics = await this.validateModelPerformance(trainingResult);
            
            if (metrics.accuracy < MIN_ACCURACY_THRESHOLD) {
                throw new Error(`Model accuracy ${metrics.accuracy} below threshold ${MIN_ACCURACY_THRESHOLD}`);
            }

            // Update model registry
            await this.updateModelRegistry(metrics);

            return metrics;

        } catch (error) {
            this.logger.error('Model training failed', { error });
            throw error;
        }
    }

    /**
     * Evaluates model performance with comprehensive metrics
     */
    async evaluateModel(
        validationData: Float32Array[],
        validationLabels: NeedType[]
    ): Promise<IModelMetrics> {
        try {
            if (!this.model) {
                throw new Error('No model loaded for evaluation');
            }

            // Extract features from validation data
            const features = await this.extractFeatures(validationData);

            // Prepare validation dataset
            const { xs, ys } = this.prepareTrainingData(features, validationLabels);

            // Evaluate model
            const evaluation = await this.model.evaluate(xs, ys, {
                batchSize: DEFAULT_BATCH_SIZE,
                verbose: 1
            }) as tf.Scalar[];

            // Calculate comprehensive metrics
            const predictions = await this.model.predict(xs) as tf.Tensor;
            const metrics = await this.calculateMetrics(predictions, ys);

            // Monitor for model drift
            await this.checkModelDrift(metrics);

            return metrics;

        } catch (error) {
            this.logger.error('Model evaluation failed', { error });
            throw error;
        }
    }

    /**
     * Saves model with versioning and validation
     */
    async saveModel(modelPath: string, config: IModelConfig): Promise<void> {
        try {
            if (!this.model) {
                throw new Error('No model to save');
            }

            // Generate model version
            const version = this.generateModelVersion();

            // Optimize model for storage
            const optimizedModel = await this.optimizeModel(this.model);

            // Save model artifacts
            await optimizedModel.save(`file://${modelPath}`);

            // Update model registry
            this.modelRegistry.set(config.modelId, {
                ...config,
                version,
                lastTrainingDate: new Date()
            });

            // Validate saved model
            await this.validateSavedModel(modelPath);

            this.logger.log(`Model saved successfully: ${modelPath}`);

        } catch (error) {
            this.logger.error('Model saving failed', { error });
            throw error;
        }
    }

    private async initializeEnvironment(): Promise<void> {
        // Configure TensorFlow environment
        await tf.setBackend('tensorflow');
        tf.enableProdMode();

        // Setup resource monitoring
        this.setupResourceMonitoring();

        // Initialize checkpoint manager
        this.initializeCheckpointManager();

        this.logger.log('Model training environment initialized');
    }

    private async configureDistributedStrategy(): Promise<tf.DistributedStrategy> {
        return tf.distribute.getMirroredStrategy();
    }

    private async initializeModel(config: IModelTrainingConfig): Promise<void> {
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [config.inputDimension],
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: Object.keys(NeedType).length,
                    activation: 'softmax'
                })
            ]
        });

        this.model.compile({
            optimizer: tf.train.adam(config.learningRate || DEFAULT_LEARNING_RATE),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
    }

    private setupResourceMonitoring(): void {
        this.resourceMonitor = setInterval(() => {
            const memoryInfo = process.memoryUsage();
            const memoryUsage = memoryInfo.heapUsed / memoryInfo.heapTotal;

            if (memoryUsage > MAX_MEMORY_USAGE) {
                this.logger.warn('High memory usage detected', { memoryUsage });
                global.gc?.();
            }
        }, 60000);
    }

    private async validateTrainingData(
        data: Float32Array[],
        labels: NeedType[]
    ): Promise<{ data: Float32Array[]; labels: NeedType[] }> {
        if (!data.length || data.length !== labels.length) {
            throw new Error('Invalid training data or labels');
        }

        return { data, labels };
    }

    private async extractFeatures(data: Float32Array[]): Promise<Float32Array[]> {
        return Promise.all(
            data.map(sample => this.featureExtractionService.extractFeatures(
                sample,
                16000,
                { enableNoiseReduction: true }
            ))
        );
    }

    private prepareTrainingData(
        features: Float32Array[],
        labels: NeedType[]
    ): { xs: tf.Tensor; ys: tf.Tensor } {
        const xs = tf.tensor2d(features);
        const ys = tf.oneHot(
            labels.map(label => Object.values(NeedType).indexOf(label)),
            Object.keys(NeedType).length
        );

        return { xs, ys };
    }

    private async calculateMetrics(
        predictions: tf.Tensor,
        actual: tf.Tensor
    ): Promise<IModelMetrics> {
        const predArray = await predictions.array();
        const actualArray = await actual.array();

        return {
            accuracy: tf.metrics.accuracy(actual, predictions).dataSync()[0],
            precision: this.calculatePrecision(predArray, actualArray),
            recall: this.calculateRecall(predArray, actualArray),
            f1Score: this.calculateF1Score(predArray, actualArray),
            confusionMatrix: this.calculateConfusionMatrix(predArray, actualArray),
            trainingTime: Date.now(),
            resourceUtilization: this.getResourceUtilization()
        };
    }

    private async checkModelDrift(metrics: IModelMetrics): Promise<void> {
        const previousMetrics = Array.from(this.trainingMetrics.values());
        if (previousMetrics.length > 0) {
            const avgPreviousAccuracy = previousMetrics.reduce(
                (sum, m) => sum + m.accuracy,
                0
            ) / previousMetrics.length;

            if (metrics.accuracy < avgPreviousAccuracy * 0.9) {
                this.logger.warn('Model drift detected', {
                    currentAccuracy: metrics.accuracy,
                    averagePreviousAccuracy: avgPreviousAccuracy
                });
            }
        }
    }

    private getResourceUtilization(): Record<string, any> {
        const memory = process.memoryUsage();
        return {
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            external: memory.external,
            cpuUsage: process.cpuUsage()
        };
    }
}