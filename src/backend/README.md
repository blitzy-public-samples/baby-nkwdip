# Baby Cry Analyzer Backend Service

Enterprise-grade backend service for the Baby Cry Analyzer application, providing real-time audio analysis, pattern recognition, and personalized baby care recommendations.

## Features

- Real-time cry analysis with >90% classification accuracy
- Pattern learning algorithms with <2 weeks learning speed
- Background noise filtering and audio processing
- Secure user and baby profile management
- Role-based access control (Parent, Caregiver, Expert, Admin)
- Comprehensive API documentation with Swagger
- Production-ready monitoring and observability

## Prerequisites

- Node.js >= 18.0.0
- MongoDB 6.0+
- Redis 7.0+
- Docker 20.10+
- TensorFlow with GPU support (optional)

## Tech Stack

- NestJS 9.x - Backend framework
- MongoDB 6.0 - Primary database
- Redis 7.0 - Caching and session management
- TensorFlow.js 4.2 - Machine learning
- JWT/Auth0 - Authentication
- NewRelic - Application monitoring

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy environment template and configure:

```bash
cp .env.example .env
```

3. Start required services:

```bash
docker-compose up -d
```

## Environment Configuration

Required environment variables:

```env
# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=mongodb://localhost:27017/baby-cry-analyzer
DATABASE_NAME=baby-cry-analyzer

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Authentication
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRATION=1h
AUTH0_DOMAIN=your_auth0_domain
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret

# AWS Services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_s3_bucket

# Security
ENCRYPTION_KEY=your_encryption_key
```

## Development

Start the development server:

```bash
npm run start:dev
```

Run tests:

```bash
npm run test        # Unit tests
npm run test:e2e    # E2E tests
npm run test:cov    # Coverage report
```

## API Documentation

Swagger documentation is available at `/api/docs` when running the server.

### Main Endpoints

- `/api/v1/auth` - Authentication endpoints
- `/api/v1/analysis` - Cry analysis endpoints
- `/api/v1/babies` - Baby profile management
- `/api/v1/users` - User management

## Security

- JWT-based authentication with refresh tokens
- Role-based access control
- Request rate limiting
- Data encryption at rest
- CORS protection
- XSS prevention
- CSRF protection
- Security headers with Helmet
- Input validation
- Audit logging

## Monitoring

Health check endpoint: `/health`
Metrics endpoint: `/metrics`

Monitoring includes:
- Error rate tracking
- Response time monitoring
- CPU/Memory usage
- ML model performance
- Audio processing metrics

Alert thresholds:
- Error rate: 1%
- Response time: 500ms p95
- CPU usage: 80%
- Memory usage: 85%

## Production Deployment

1. Build the application:

```bash
npm run build
```

2. Start in production mode:

```bash
npm run start:prod
```

Docker deployment:

```bash
docker build -t baby-cry-analyzer-backend .
docker run -p 3000:3000 baby-cry-analyzer-backend
```

## Architecture

The application follows a microservices architecture with:

- API Gateway for request routing
- Authentication Service
- Analysis Service
- ML Service
- User Service
- Baby Profile Service

## Performance Optimization

- Redis caching
- Database indexing
- Request batching
- GPU acceleration for ML
- Response compression
- Connection pooling
- Query optimization

## Contributing

1. Follow the coding style guide
2. Write tests for new features
3. Update documentation
4. Submit pull requests for review

## License

Private and Confidential - All rights reserved