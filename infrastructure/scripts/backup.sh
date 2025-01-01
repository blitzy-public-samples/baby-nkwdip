#!/bin/bash

# Baby Cry Analyzer Backup Script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.x
# - mongodb-database-tools v100.7.x
# - redis-tools v7.0.x

set -euo pipefail

# Global Variables
BACKUP_ROOT="/var/backups/baby-cry-analyzer"
RETENTION_DAYS=90
MONGODB_BACKUP_DIR="${BACKUP_ROOT}/mongodb"
REDIS_BACKUP_DIR="${BACKUP_ROOT}/redis"
LOG_FILE="/var/log/baby-cry-analyzer/backup.log"
MAX_RETRIES=3
BACKUP_TIMEOUT=3600
ENCRYPTION_KEY_PATH="/etc/baby-cry-analyzer/backup-key.aes"
METRIC_NAMESPACE="BabyCryAnalyzer/Backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Setup logging with timestamps
log_backup_status() {
    local operation=$1
    local status=$2
    local message=$3
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] ${operation} - ${status}: ${message}" >> "${LOG_FILE}"
    
    # Send metrics to CloudWatch
    aws cloudwatch put-metric-data \
        --namespace "${METRIC_NAMESPACE}" \
        --metric-name "BackupStatus" \
        --dimensions Operation="${operation}" \
        --value "$([[ ${status} == "SUCCESS" ]] && echo 1 || echo 0)" \
        --unit Count

    # Alert on failure
    if [[ ${status} == "FAILURE" ]]; then
        aws sns publish \
            --topic-arn "${SNS_TOPIC_ARN}" \
            --message "Backup ${operation} failed: ${message}"
    fi
}

setup_environment() {
    # Create backup directories
    mkdir -p "${MONGODB_BACKUP_DIR}" "${REDIS_BACKUP_DIR}"
    chmod 700 "${MONGODB_BACKUP_DIR}" "${REDIS_BACKUP_DIR}"

    # Verify required tools
    command -v aws >/dev/null 2>&1 || { log_backup_status "SETUP" "FAILURE" "aws-cli not installed"; exit 1; }
    command -v mongodump >/dev/null 2>&1 || { log_backup_status "SETUP" "FAILURE" "mongodump not installed"; exit 1; }
    command -v redis-cli >/dev/null 2>&1 || { log_backup_status "SETUP" "FAILURE" "redis-cli not installed"; exit 1; }

    # Load AWS credentials from k8s secrets
    export AWS_ACCESS_KEY_ID=$(kubectl get secret baby-cry-analyzer-secrets -n baby-cry-analyzer -o jsonpath='{.data.AWS_ACCESS_KEY_ID}' | base64 -d)
    export AWS_SECRET_ACCESS_KEY=$(kubectl get secret baby-cry-analyzer-secrets -n baby-cry-analyzer -o jsonpath='{.data.AWS_SECRET_ACCESS_KEY}' | base64 -d)
    export AWS_REGION=$(kubectl get secret baby-cry-analyzer-secrets -n baby-cry-analyzer -o jsonpath='{.data.AWS_REGION}' | base64 -d)
    export S3_BUCKET_NAME=$(kubectl get secret baby-cry-analyzer-secrets -n baby-cry-analyzer -o jsonpath='{.data.S3_BUCKET_NAME}' | base64 -d)

    log_backup_status "SETUP" "SUCCESS" "Environment initialized"
}

backup_mongodb() {
    local backup_path="${MONGODB_BACKUP_DIR}/${TIMESTAMP}"
    local retry_count=0
    
    while [[ ${retry_count} -lt ${MAX_RETRIES} ]]; do
        try {
            # Get MongoDB credentials from k8s secrets
            local mongodb_uri=$(kubectl get secret baby-cry-analyzer-secrets -n baby-cry-analyzer -o jsonpath='{.data.DATABASE_URL}' | base64 -d)
            
            # Create MongoDB backup
            mongodump --uri="${mongodb_uri}" \
                     --out="${backup_path}" \
                     --gzip \
                     --oplog \
                     --numParallelCollections=4

            # Generate backup checksum
            find "${backup_path}" -type f -exec sha256sum {} \; > "${backup_path}.sha256"

            # Encrypt backup
            tar czf - "${backup_path}" | \
                openssl enc -aes-256-cbc -salt -pbkdf2 \
                -in - \
                -out "${backup_path}.tar.gz.enc" \
                -pass file:"${ENCRYPTION_KEY_PATH}"

            # Verify encryption
            openssl enc -aes-256-cbc -d -salt -pbkdf2 \
                -in "${backup_path}.tar.gz.enc" \
                -pass file:"${ENCRYPTION_KEY_PATH}" \
                -out /dev/null

            log_backup_status "MONGODB" "SUCCESS" "Backup completed successfully"
            return 0
        } catch {
            retry_count=$((retry_count + 1))
            log_backup_status "MONGODB" "RETRY" "Attempt ${retry_count} failed, retrying..."
            sleep $((2 ** retry_count))
        }
    done

    log_backup_status "MONGODB" "FAILURE" "Backup failed after ${MAX_RETRIES} attempts"
    return 1
}

backup_redis() {
    local backup_path="${REDIS_BACKUP_DIR}/${TIMESTAMP}"
    local retry_count=0

    while [[ ${retry_count} -lt ${MAX_RETRIES} ]]; do
        try {
            # Get Redis credentials from k8s secrets
            local redis_uri=$(kubectl get secret baby-cry-analyzer-secrets -n baby-cry-analyzer -o jsonpath='{.data.REDIS_URL}' | base64 -d)

            # Trigger Redis SAVE
            redis-cli -u "${redis_uri}" SAVE

            # Copy and compress RDB file
            redis-cli -u "${redis_uri}" --rdb "${backup_path}.rdb"
            gzip -9 "${backup_path}.rdb"

            # Encrypt backup
            openssl enc -aes-256-cbc -salt -pbkdf2 \
                -in "${backup_path}.rdb.gz" \
                -out "${backup_path}.rdb.gz.enc" \
                -pass file:"${ENCRYPTION_KEY_PATH}"

            # Generate checksum
            sha256sum "${backup_path}.rdb.gz.enc" > "${backup_path}.rdb.gz.enc.sha256"

            log_backup_status "REDIS" "SUCCESS" "Backup completed successfully"
            return 0
        } catch {
            retry_count=$((retry_count + 1))
            log_backup_status "REDIS" "RETRY" "Attempt ${retry_count} failed, retrying..."
            sleep $((2 ** retry_count))
        }
    done

    log_backup_status "REDIS" "FAILURE" "Backup failed after ${MAX_RETRIES} attempts"
    return 1
}

upload_to_s3() {
    local source_path=$1
    local s3_prefix=$2
    local retry_count=0

    while [[ ${retry_count} -lt ${MAX_RETRIES} ]]; do
        try {
            # Upload encrypted backup with metadata
            aws s3 cp "${source_path}" \
                "s3://${S3_BUCKET_NAME}/${s3_prefix}/" \
                --metadata "timestamp=${TIMESTAMP},checksum=$(sha256sum ${source_path} | cut -d' ' -f1)" \
                --storage-class STANDARD_IA

            # Verify upload
            aws s3api head-object \
                --bucket "${S3_BUCKET_NAME}" \
                --key "${s3_prefix}/$(basename ${source_path})"

            log_backup_status "UPLOAD" "SUCCESS" "Upload to S3 completed successfully"
            return 0
        } catch {
            retry_count=$((retry_count + 1))
            log_backup_status "UPLOAD" "RETRY" "Attempt ${retry_count} failed, retrying..."
            sleep $((2 ** retry_count))
        }
    done

    log_backup_status "UPLOAD" "FAILURE" "Upload failed after ${MAX_RETRIES} attempts"
    return 1
}

cleanup_old_backups() {
    local retention_days=$1

    # Clean local backups
    find "${BACKUP_ROOT}" -type f -mtime +${retention_days} -delete
    
    # Clean S3 backups
    aws s3 ls "s3://${S3_BUCKET_NAME}" --recursive | \
        while read -r line; do
            timestamp=$(echo "$line" | awk '{print $1" "$2}')
            key=$(echo "$line" | awk '{print $4}')
            if [[ $(date -d "${timestamp}" +%s) -lt $(date -d "-${retention_days} days" +%s) ]]; then
                aws s3 rm "s3://${S3_BUCKET_NAME}/${key}"
            fi
        done

    log_backup_status "CLEANUP" "SUCCESS" "Old backups cleaned up successfully"
}

main() {
    setup_environment

    # Start backup process with timeout
    timeout ${BACKUP_TIMEOUT} bash -c '
        backup_mongodb && \
        backup_redis && \
        upload_to_s3 "${MONGODB_BACKUP_DIR}/${TIMESTAMP}.tar.gz.enc" "mongodb" && \
        upload_to_s3 "${REDIS_BACKUP_DIR}/${TIMESTAMP}.rdb.gz.enc" "redis" && \
        cleanup_old_backups ${RETENTION_DAYS}
    '

    exit_code=$?
    if [[ ${exit_code} -eq 0 ]]; then
        log_backup_status "BACKUP" "SUCCESS" "Full backup process completed successfully"
    else
        log_backup_status "BACKUP" "FAILURE" "Backup process failed with exit code ${exit_code}"
        exit ${exit_code}
    fi
}

main "$@"