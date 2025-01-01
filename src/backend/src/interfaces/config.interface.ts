/**
 * Configuration interfaces for the Baby Cry Analyzer backend application
 * Defines strongly-typed configuration structures for app settings, authentication,
 * databases, and storage services with comprehensive security patterns
 * @version 1.0.0
 */

/**
 * Valid environment types for the application
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Main application configuration interface
 * Defines core settings including security and rate limiting
 */
export interface AppConfig {
  /** HTTP port the application listens on */
  port: number;
  
  /** Host address for the application */
  host: string;
  
  /** Global API route prefix */
  apiPrefix: string;
  
  /** Current environment */
  environment: Environment;
  
  /** Allowed CORS origins for security */
  corsOrigins: string[];
  
  /** Rate limiting window in milliseconds */
  rateLimitWindow: number;
  
  /** Maximum requests per rate limit window */
  rateLimitMax: number;
}

/**
 * Authentication configuration interface
 * Defines security settings for JWT and Auth0 integration
 */
export interface AuthConfig {
  /** Secret key for JWT signing */
  jwtSecret: string;
  
  /** JWT token expiration time */
  jwtExpiresIn: string;
  
  /** Refresh token expiration time */
  refreshTokenExpiresIn: string;
  
  /** Auth0 domain URL */
  auth0Domain: string;
  
  /** Auth0 client identifier */
  auth0ClientId: string;
  
  /** Auth0 client secret */
  auth0ClientSecret: string;
  
  /** Regex pattern for token validation */
  tokenValidationPattern: RegExp;
  
  /** Maximum login attempts before lockout */
  maxLoginAttempts: number;
}

/**
 * MongoDB database configuration interface
 * Defines settings for database connection and optimization
 */
export interface DatabaseConfig {
  /** MongoDB connection URI */
  uri: string;
  
  /** Database name */
  name: string;
  
  /** MongoDB connection options */
  options: MongoConnectionOptions;
  
  /** Maximum connection pool size */
  maxPoolSize: number;
  
  /** Enable retry writes */
  retryWrites: boolean;
  
  /** Replica set name if using replication */
  replicaSet: string;
}

/**
 * S3 storage configuration interface
 * Defines settings for secure file storage
 */
export interface S3Config {
  /** S3 bucket name */
  bucketName: string;
  
  /** AWS region */
  region: string;
  
  /** AWS access key ID */
  accessKeyId: string;
  
  /** AWS secret access key */
  secretAccessKey: string;
  
  /** Maximum file upload size in MB */
  uploadLimitMB: number;
  
  /** List of allowed file types */
  allowedFileTypes: string[];
}

/**
 * Redis cache configuration interface
 * Defines settings for caching and performance optimization
 */
export interface RedisConfig {
  /** Redis server host */
  host: string;
  
  /** Redis server port */
  port: number;
  
  /** Redis authentication password */
  password: string;
  
  /** Cache TTL in seconds */
  ttl: number;
  
  /** Redis memory management policy */
  maxMemoryPolicy: string;
  
  /** Key prefix for namespacing */
  keyPrefix: string;
  
  /** Enable cluster mode */
  cluster: boolean;
}

/**
 * MongoDB connection options interface
 * Defines detailed MongoDB connection parameters
 */
interface MongoConnectionOptions {
  useNewUrlParser: boolean;
  useUnifiedTopology: boolean;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  connectTimeoutMS: number;
  retryAttempts: number;
  ssl: boolean;
}