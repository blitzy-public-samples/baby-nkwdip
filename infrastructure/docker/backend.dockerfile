# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install Python and build dependencies for TensorFlow
RUN apk add --no-cache python3 py3-pip make g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY src/backend/package*.json ./
COPY src/backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/backend/src ./src

# Build application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Install Python for TensorFlow runtime
RUN apk add --no-cache python3 py3-pip \
    && ln -sf python3 /usr/bin/python

# Create app directory and set ownership
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# Install TensorFlow dependencies
RUN pip3 install --no-cache-dir tensorflow==2.12.0

# Copy built artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Create required directories with proper permissions
RUN mkdir -p /app/models && \
    chown -R nodejs:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV TENSORFLOW_BACKEND=tensorflow

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set memory limits for Node.js
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Configure TensorFlow optimizations
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV TF_NUM_INTEROP_THREADS=1
ENV TF_NUM_INTRAOP_THREADS=2

# Define volumes
VOLUME ["/app/models", "/app/node_modules", "/app/dist"]

# Start application
CMD ["node", "dist/main"]