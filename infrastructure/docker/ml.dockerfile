# Build stage
FROM python:3.9-slim AS builder

# Version labels and metadata
LABEL maintainer="Baby Cry Analyzer Team" \
      version="1.0.0" \
      description="ML Service for Baby Cry Analysis"

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    nvidia-cuda-toolkit-11.2 \
    && rm -rf /var/lib/apt/lists/*

# Set up virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies with optimized flags
RUN pip install --no-cache-dir \
    tensorflow-gpu==4.2.0 \
    numpy==1.23.0 \
    scipy==1.9.0 \
    librosa==0.9.0 \
    pandas \
    scikit-learn \
    pytest \
    prometheus-client \
    newrelic \
    gunicorn

# Production stage
FROM python:3.9-slim

# Install runtime dependencies and CUDA runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    nvidia-cuda-runtime-11.2 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy built dependencies from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy application code
COPY ./src/backend/src/modules/ml /app/src/ml
COPY ./src/backend/src/common /app/src/common

# Set environment variables for ML optimization
ENV PYTHONPATH=/app/src \
    TENSORFLOW_VERSION=4.2.0 \
    NODE_ENV=production \
    CUDA_VISIBLE_DEVICES=0 \
    TF_FORCE_GPU_ALLOW_GROWTH=true \
    TF_NUM_INTEROP_THREADS=4 \
    TF_NUM_INTRAOP_THREADS=4

# Create non-root user
RUN useradd -r -s /bin/false mlservice && \
    chown -R mlservice:mlservice /app

# Switch to non-root user
USER mlservice

# Configure resource limits
ENV MEMORY_LIMIT="8g" \
    CPU_LIMIT="4"

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Expose ports
EXPOSE 5000

# Set entrypoint
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--threads", "4", "--timeout", "120", "ml.app:create_app()"]