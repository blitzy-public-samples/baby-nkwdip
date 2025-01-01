#!/bin/bash
set -euo pipefail

# Baby Cry Analyzer Backend Deployment Script
# Version: 1.0.0
# Dependencies:
# - docker v20.10+
# - aws-cli v2.x
# - snyk v1.x
# - newrelic-cli latest

# Load environment variables
source .env 2>/dev/null || true

# Global variables
ENV=${ENVIRONMENT:-development}
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
IMAGE_TAG=${GITHUB_SHA:-latest}
HEALTH_CHECK_ENDPOINT="/api/v1/health"
ROLLBACK_VERSIONS=3
DEPLOYMENT_TIMEOUT=600
MONITORING_ENABLED=true

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
}

# Check deployment prerequisites
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker is not installed"
        exit 1
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log "ERROR" "AWS CLI is not installed"
        exit 1
    }

    # Check Snyk
    if ! command -v snyk &> /dev/null; then
        log "ERROR" "Snyk is not installed"
        exit 1
    }

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "Invalid AWS credentials"
        exit 1
    }

    # Check ECR access
    if ! aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY} &> /dev/null; then
        log "ERROR" "Failed to authenticate with ECR"
        exit 1
    }

    log "INFO" "Prerequisites check completed successfully"
}

# Security scanning function
security_scan() {
    local image_name=$1
    log "INFO" "Starting security scan for ${image_name}"

    # Run Snyk container scan
    if ! snyk container test ${image_name} --severity-threshold=high; then
        log "ERROR" "Security vulnerabilities found in container image"
        return 1
    }

    # Run additional security checks
    if ! docker scout cves ${image_name}; then
        log "WARNING" "Additional vulnerabilities detected"
    }

    log "INFO" "Security scan completed successfully"
    return 0
}

# Deploy service function
deploy_service() {
    local environment=$1
    local version=$2

    log "INFO" "Starting deployment to ${environment} environment"

    # Build container image
    log "INFO" "Building container image..."
    docker build -t ${ECR_REGISTRY}/baby-cry-analyzer-backend:${version} \
        --build-arg NODE_ENV=${environment} \
        --build-arg BUILD_VERSION=${version} \
        .

    # Run security scan
    if ! security_scan ${ECR_REGISTRY}/baby-cry-analyzer-backend:${version}; then
        log "ERROR" "Security scan failed"
        exit 1
    }

    # Push to ECR
    log "INFO" "Pushing image to ECR..."
    docker push ${ECR_REGISTRY}/baby-cry-analyzer-backend:${version}

    # Deploy based on environment
    case ${environment} in
        development)
            replicas=2
            health_check_delay=20
            monitoring_level="basic"
            ;;
        staging)
            replicas=3
            health_check_delay=30
            monitoring_level="enhanced"
            ;;
        production)
            replicas=6
            health_check_delay=40
            monitoring_level="comprehensive"
            ;;
        *)
            log "ERROR" "Invalid environment specified"
            exit 1
            ;;
    esac

    # Apply deployment
    log "INFO" "Applying deployment configuration..."
    kubectl apply -f <(cat <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: baby-cry-analyzer-backend
  namespace: ${environment}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: baby-cry-analyzer-backend
  template:
    metadata:
      labels:
        app: baby-cry-analyzer-backend
    spec:
      containers:
      - name: backend
        image: ${ECR_REGISTRY}/baby-cry-analyzer-backend:${version}
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: ${HEALTH_CHECK_ENDPOINT}
            port: 3000
          initialDelaySeconds: ${health_check_delay}
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
EOF
)

    # Monitor deployment
    monitor_deployment ${environment} ${version}
}

# Monitor deployment function
monitor_deployment() {
    local environment=$1
    local version=$2
    local timeout=${DEPLOYMENT_TIMEOUT}
    local start_time=$(date +%s)

    log "INFO" "Monitoring deployment..."

    # Initialize New Relic monitoring if enabled
    if [[ "${MONITORING_ENABLED}" == "true" ]]; then
        newrelic deployment record \
            --revision="${version}" \
            --user="${GITHUB_ACTOR:-system}" \
            --environment="${environment}"
    fi

    # Wait for deployment to complete
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ ${elapsed} -gt ${timeout} ]]; then
            log "ERROR" "Deployment timeout exceeded"
            rollback ${environment} ${version}
            exit 1
        fi

        local ready_replicas=$(kubectl get deployment baby-cry-analyzer-backend -n ${environment} -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get deployment baby-cry-analyzer-backend -n ${environment} -o jsonpath='{.spec.replicas}')

        if [[ "${ready_replicas}" == "${desired_replicas}" ]]; then
            log "INFO" "Deployment completed successfully"
            break
        fi

        sleep 10
    done

    # Verify health checks
    if ! curl -sf http://localhost:3000${HEALTH_CHECK_ENDPOINT}; then
        log "ERROR" "Health check failed"
        rollback ${environment} ${version}
        exit 1
    }

    log "SUCCESS" "Deployment to ${environment} completed successfully"
}

# Rollback function
rollback() {
    local environment=$1
    local version=$2

    log "WARNING" "Initiating rollback for version ${version} in ${environment}"

    # Get previous version
    local previous_version=$(kubectl rollout history deployment/baby-cry-analyzer-backend -n ${environment} | tail -n 2 | head -n 1 | awk '{print $1}')

    # Perform rollback
    kubectl rollout undo deployment/baby-cry-analyzer-backend -n ${environment}

    log "INFO" "Rolled back to version ${previous_version}"

    # Monitor rollback
    monitor_deployment ${environment} ${previous_version}
}

# Main execution
main() {
    log "INFO" "Starting deployment process for Baby Cry Analyzer Backend"

    # Parse command line arguments
    while getopts "e:v:" opt; do
        case ${opt} in
            e)
                ENV=$OPTARG
                ;;
            v)
                IMAGE_TAG=$OPTARG
                ;;
            \?)
                log "ERROR" "Invalid option: -$OPTARG"
                exit 1
                ;;
        esac
    done

    # Execute deployment steps
    check_prerequisites
    deploy_service ${ENV} ${IMAGE_TAG}
}

# Execute main function
main "$@"