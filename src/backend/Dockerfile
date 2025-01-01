# Stage 1: Builder
FROM node:18-alpine AS builder

# Install security scanning tools
RUN apk add --no-cache curl python3 py3-pip trivy
RUN trivy --download-db-only

# Scan base image
RUN trivy image node:18-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3-dev \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Copy package files with strict permissions
COPY --chown=node:node package*.json ./

# Security audit and install dependencies
RUN npm audit
RUN npm ci --ignore-scripts

# Copy source code and config files
COPY --chown=node:node . .

# Build application
RUN npm run build

# Run security tests and linting
RUN npm run lint
RUN npm run test

# Prune dev dependencies
RUN npm prune --production

# Scan built artifacts
RUN trivy filesystem --severity HIGH,CRITICAL /app

# Stage 2: Production
FROM node:18-alpine AS production

# Security scanning
RUN apk add --no-cache trivy
RUN trivy image node:18-alpine

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Install production dependencies
RUN apk add --no-cache \
    curl \
    tini

# Copy built artifacts from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./

# Set proper permissions
RUN chmod -R 550 /app && \
    chmod -R 500 /app/node_modules && \
    chmod -R 500 /app/dist

# Configure environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
ENV PORT=3000

# Set resource limits
RUN echo "appuser soft nofile 65536" >> /etc/security/limits.conf && \
    echo "appuser hard nofile 65536" >> /etc/security/limits.conf

# Configure Node.js optimizations
ENV NODE_OPTIONS="--max-old-space-size=2048 \
    --max-http-header-size=16384 \
    --no-experimental-fetch \
    --heapsnapshot-near-heap-limit=3"

# Expose port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/main"]