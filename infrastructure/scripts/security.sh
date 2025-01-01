#!/bin/bash

# Baby Cry Analyzer - Security Audit and Hardening Script
# Version: 1.0.0
# Dependencies:
# - kubectl v1.24+
# - trivy 0.9.2
# - kubesec 2.11.0

set -euo pipefail

# Global Configuration
ENVIRONMENT=${ENV:-production}
LOG_FILE="/var/log/security-audit.log"
ALERT_EMAIL="security@babycryanalyzer.com"
CRITICAL_VULN_THRESHOLD="CVSS:7.0"
MAX_RETRY_ATTEMPTS=3
CREDENTIAL_MAX_AGE=90

# Logging Configuration
setup_logging() {
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting security audit for environment: ${ENVIRONMENT}"
}

# Error handling
error_handler() {
    local line_no=$1
    local error_code=$2
    echo "[ERROR] Failed at line ${line_no} with error code ${error_code}"
    send_alert "Security script failure" "Script failed at line ${line_no} with error ${error_code}"
    exit "${error_code}"
}
trap 'error_handler ${LINENO} $?' ERR

# Alert System
send_alert() {
    local subject=$1
    local message=$2
    echo "[ALERT] ${subject}: ${message}"
    # Send email alert
    echo "${message}" | mail -s "[BCA Security Alert] ${subject}" "${ALERT_EMAIL}"
}

# Check Prerequisites
check_prerequisites() {
    local missing_deps=()
    
    # Check required tools
    for tool in kubectl trivy kubesec; do
        if ! command -v "${tool}" &> /dev/null; then
            missing_deps+=("${tool}")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Secret Encryption Validation
check_secrets_encryption() {
    local namespace=$1
    echo "[INFO] Checking secrets encryption in namespace: ${namespace}"
    
    # Verify secrets are encrypted
    kubectl get secrets -n "${namespace}" -o json | jq -r '.items[] | select(.metadata.annotations["encryption.kubernetes.io/encryption-provider"] != "aes-256")' > unencrypted_secrets.json
    
    if [ -s unencrypted_secrets.json ]; then
        send_alert "Unencrypted Secrets Found" "Some secrets in ${namespace} are not properly encrypted"
        return 1
    fi
    
    # Check secret rotation
    local current_time
    current_time=$(date +%s)
    
    kubectl get secrets -n "${namespace}" -o json | \
    jq -r '.items[] | select(
        (.metadata.annotations["last-rotated"] | fromdateiso8601) < 
        (now - '"${CREDENTIAL_MAX_AGE}"'*24*60*60)
    )' > expired_secrets.json
    
    if [ -s expired_secrets.json ]; then
        send_alert "Expired Secrets" "Secrets in ${namespace} require rotation"
    fi
}

# Container Security Scanning
scan_containers() {
    local namespace=$1
    echo "[INFO] Scanning containers in namespace: ${namespace}"
    
    # Get all running containers
    kubectl get pods -n "${namespace}" -o json | \
    jq -r '.items[].spec.containers[].image' | sort -u > container_images.txt
    
    while IFS= read -r image; do
        echo "[INFO] Scanning image: ${image}"
        
        # Run Trivy vulnerability scan
        if ! trivy image --severity HIGH,CRITICAL --exit-code 1 "${image}"; then
            send_alert "Critical Vulnerabilities" "Found in image: ${image}"
        fi
        
        # Run Kubesec scan on deployments
        kubectl get deployment -n "${namespace}" -o yaml | \
        kubesec scan - > kubesec_results.json
        
        if jq -e '.[] | select(.score < 80)' kubesec_results.json > /dev/null; then
            send_alert "Low Security Score" "Deployment security score below threshold"
        fi
    done < container_images.txt
}

# Configuration Audit
audit_configurations() {
    local namespace=$1
    echo "[INFO] Auditing configurations in namespace: ${namespace}"
    
    # Check RBAC permissions
    kubectl auth can-i --list -n "${namespace}" > rbac_audit.txt
    
    # Validate ConfigMap security
    kubectl get configmap -n "${namespace}" -o yaml | \
    grep -i "password\|secret\|key\|token" > configmap_sensitive.txt
    
    if [ -s configmap_sensitive.txt ]; then
        send_alert "Sensitive Data in ConfigMap" "Found sensitive data in ConfigMaps"
    fi
    
    # Check Network Policies
    if ! kubectl get networkpolicy -n "${namespace}" &> /dev/null; then
        send_alert "Missing Network Policies" "No network policies found in ${namespace}"
    fi
}

# Compliance Checks
check_compliance() {
    local namespace=$1
    echo "[INFO] Performing compliance checks for: ${namespace}"
    
    # HIPAA Compliance
    check_encryption_compliance
    check_audit_logging
    check_access_controls
    
    # GDPR Compliance
    check_data_retention
    check_data_encryption
    check_privacy_controls
    
    # COPPA Compliance
    check_data_collection_limits
    check_parental_consent_controls
}

# Main Security Check Orchestrator
run_security_checks() {
    local namespace=${1:-baby-cry-analyzer}
    
    setup_logging
    check_prerequisites
    
    echo "[INFO] Starting security checks for namespace: ${namespace}"
    
    # Run core security checks
    check_secrets_encryption "${namespace}"
    scan_containers "${namespace}"
    audit_configurations "${namespace}"
    check_compliance "${namespace}"
    
    # Generate report
    generate_security_report
    
    echo "[INFO] Security checks completed. Check ${LOG_FILE} for details."
}

# Helper Functions
check_encryption_compliance() {
    echo "[INFO] Checking encryption compliance"
    # Verify AES-256 encryption
    kubectl get secrets -n "${namespace}" -o json | \
    jq -r '.items[] | select(.metadata.annotations["encryption.kubernetes.io/encryption-provider"] == "aes-256")'
}

check_audit_logging() {
    echo "[INFO] Verifying audit logging"
    kubectl get secrets -n "${namespace}" -o json | \
    jq -r '.items[] | select(.metadata.annotations["audit-log-enabled"] == "true")'
}

generate_security_report() {
    local report_file="security_report_$(date +%Y%m%d).html"
    echo "[INFO] Generating security report: ${report_file}"
    
    # Generate HTML report with findings
    {
        echo "<html><body>"
        echo "<h1>Security Audit Report</h1>"
        echo "<h2>Environment: ${ENVIRONMENT}</h2>"
        echo "<h2>Date: $(date)</h2>"
        
        # Add sections for each security check
        echo "<h3>Secret Encryption Status</h3>"
        cat unencrypted_secrets.json
        
        echo "<h3>Container Scan Results</h3>"
        cat kubesec_results.json
        
        echo "<h3>Configuration Audit</h3>"
        cat rbac_audit.txt
        
        echo "</body></html>"
    } > "${report_file}"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_security_checks "$@"
fi