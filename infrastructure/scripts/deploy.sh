#!/bin/bash

# Baby Cry Analyzer - Enterprise Deployment Script
# Version: 1.0.0
# Requires: aws-cli v2.x, kubectl v1.24+, terraform v1.4+, snyk v1.x

set -euo pipefail

# Global Configuration
readonly AWS_REGIONS=('us-east-1' 'us-west-2' 'eu-central-1')
readonly ENVIRONMENTS=('dev' 'staging' 'prod')
readonly DOCKER_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
readonly SECURITY_SCAN_THRESHOLD="HIGH"
readonly DEPLOYMENT_TIMEOUT=600
readonly HEALTH_CHECK_INTERVAL=30

# Import helper functions
source "$(dirname "$0")/monitoring.sh"
source "$(dirname "$0")/security.sh"

# Logging configuration
setup_logging() {
    local log_file="/var/log/deploy-$(date +%Y%m%d-%H%M%S).log"
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting deployment process..."
}

# Validate deployment prerequisites
validate_deployment_prerequisites() {
    local environment="$1"
    local region="$2"
    
    echo "Validating deployment prerequisites for ${environment} in ${region}..."
    
    # Verify required tools
    command -v aws >/dev/null 2>&1 || { echo "AWS CLI not installed"; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { echo "kubectl not installed"; exit 1; }
    command -v terraform >/dev/null 2>&1 || { echo "Terraform not installed"; exit 1; }
    command -v snyk >/dev/null 2>&1 || { echo "Snyk not installed"; exit 1; }
    
    # Validate AWS credentials
    aws sts get-caller-identity >/dev/null || { echo "Invalid AWS credentials"; exit 1; }
    
    # Check Kubernetes cluster access
    kubectl cluster-info >/dev/null || { echo "Cannot access Kubernetes cluster"; exit 1; }
    
    # Verify Terraform state access
    terraform init -backend=true -backend-config="region=${region}" >/dev/null || { echo "Cannot access Terraform state"; exit 1; }
    
    echo "Prerequisites validation completed successfully"
}

# Manage container lifecycle
manage_container_lifecycle() {
    local environment="$1"
    local version_tag="$2"
    local build_config="$3"
    
    echo "Managing container lifecycle for version ${version_tag}..."
    
    # Authenticate with ECR
    aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${DOCKER_REGISTRY}"
    
    # Build container image
    docker build -t "${DOCKER_REGISTRY}/baby-cry-analyzer-backend:${version_tag}" \
        --build-arg ENV="${environment}" \
        --file infrastructure/docker/backend.dockerfile .
    
    # Run security scan
    snyk container test "${DOCKER_REGISTRY}/baby-cry-analyzer-backend:${version_tag}" \
        --severity-threshold="${SECURITY_SCAN_THRESHOLD}" || { echo "Security scan failed"; exit 1; }
    
    # Sign container image
    cosign sign --key cosign.key "${DOCKER_REGISTRY}/baby-cry-analyzer-backend:${version_tag}"
    
    # Push to registry
    docker push "${DOCKER_REGISTRY}/baby-cry-analyzer-backend:${version_tag}"
    
    echo "Container lifecycle management completed successfully"
}

# Deploy regional infrastructure
deploy_regional_infrastructure() {
    local environment="$1"
    local region="$2"
    local terraform_config="$3"
    
    echo "Deploying infrastructure in ${region}..."
    
    # Initialize Terraform
    terraform init \
        -backend-config="bucket=${environment}-terraform-state" \
        -backend-config="key=${region}/terraform.tfstate" \
        -backend-config="region=${region}"
    
    # Plan changes
    terraform plan \
        -var="environment=${environment}" \
        -var="region=${region}" \
        -out=tfplan
    
    # Apply changes
    terraform apply -auto-approve tfplan
    
    # Verify deployment
    terraform output -json > "${region}-${environment}-output.json"
    
    echo "Infrastructure deployment completed successfully"
}

# Main deployment function
deploy_all_regions() {
    local environment="$1"
    local version_tag="$2"
    
    echo "Starting multi-region deployment for ${environment}..."
    
    # Setup logging
    setup_logging
    
    for region in "${AWS_REGIONS[@]}"; do
        echo "Processing region: ${region}"
        
        # Validate prerequisites
        validate_deployment_prerequisites "${environment}" "${region}"
        
        # Run security checks
        security_checks "${environment}" "${region}"
        
        # Deploy infrastructure
        deploy_regional_infrastructure "${environment}" "${region}" "${terraform_config}"
        
        # Manage containers
        manage_container_lifecycle "${environment}" "${version_tag}" "${build_config}"
        
        # Setup monitoring
        setup_monitoring "${environment}" "${region}"
        
        # Configure alerts
        configure_alerts "${environment}" "${region}"
        
        # Validate compliance
        compliance_validation "${environment}" "${region}"
    done
    
    echo "Multi-region deployment completed successfully"
}

# Single region deployment
deploy_single_region() {
    local environment="$1"
    local region="$2"
    local version_tag="$3"
    
    echo "Starting deployment in ${region}..."
    
    # Setup logging
    setup_logging
    
    # Validate prerequisites
    validate_deployment_prerequisites "${environment}" "${region}"
    
    # Deploy infrastructure
    deploy_regional_infrastructure "${environment}" "${region}" "${terraform_config}"
    
    # Manage containers
    manage_container_lifecycle "${environment}" "${version_tag}" "${build_config}"
    
    # Setup monitoring
    setup_monitoring "${environment}" "${region}"
    
    echo "Single region deployment completed successfully"
}

# Rollback deployment
rollback_deployment() {
    local environment="$1"
    local region="$2"
    local previous_version="$3"
    
    echo "Rolling back deployment in ${region} to version ${previous_version}..."
    
    # Revert Kubernetes deployment
    kubectl rollout undo deployment/backend -n baby-cry-analyzer
    
    # Wait for rollback to complete
    kubectl rollout status deployment/backend -n baby-cry-analyzer --timeout="${DEPLOYMENT_TIMEOUT}s"
    
    # Verify health
    for i in $(seq 1 3); do
        sleep "${HEALTH_CHECK_INTERVAL}"
        kubectl exec deploy/backend -n baby-cry-analyzer -- wget --spider http://localhost:3000/health || { echo "Health check failed"; exit 1; }
    done
    
    echo "Rollback completed successfully"
}

# Main script execution
main() {
    local command="$1"
    shift
    
    case "${command}" in
        "deploy-all")
            deploy_all_regions "$@"
            ;;
        "deploy-single")
            deploy_single_region "$@"
            ;;
        "rollback")
            rollback_deployment "$@"
            ;;
        *)
            echo "Unknown command: ${command}"
            exit 1
            ;;
    esac
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi