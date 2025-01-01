#!/bin/bash

# Enable strict error handling and debugging
set -e -o pipefail

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize test environment variables
export NODE_ENV=test
export CI=true
export JEST_JUNIT_OUTPUT_DIR="./test-results/jest"
export JEST_JUNIT_OUTPUT_NAME="results.xml"
export TEST_TIMEOUT=900000
export COVERAGE_THRESHOLD=80
export TEST_RETRY_COUNT=3
export DEBUG_LEVEL=verbose

# Determine optimal number of workers based on available CPU cores
MAX_WORKERS=$(( $(nproc) / 2 ))
export MAX_WORKERS

# Timestamp function for logging
timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

# Log function with timestamp
log() {
    echo -e "[$(timestamp)] $1"
}

# Error handling function
handle_error() {
    log "${RED}Error occurred in test execution at line $1${NC}"
    cleanup
    exit 1
}

# Set error handler
trap 'handle_error $LINENO' ERR

# Setup test environment
setup_environment() {
    log "${YELLOW}Setting up test environment...${NC}"
    
    # Create required directories
    mkdir -p "${JEST_JUNIT_OUTPUT_DIR}"
    mkdir -p coverage
    
    # Validate required files exist
    if [[ ! -f "jest.config.ts" ]]; then
        log "${RED}Error: jest.config.ts not found${NC}"
        return 1
    fi
    
    if [[ ! -f "package.json" ]]; then
        log "${RED}Error: package.json not found${NC}"
        return 1
    }
    
    # Clear previous test results
    rm -rf "${JEST_JUNIT_OUTPUT_DIR:?}"/* coverage/*
    
    log "${GREEN}Environment setup completed${NC}"
    return 0
}

# Run unit tests with coverage
run_unit_tests() {
    log "${YELLOW}Running unit tests...${NC}"
    
    local start_time=$(date +%s)
    
    # Execute Jest with coverage
    npx jest \
        --config=jest.config.ts \
        --coverage \
        --coverageDirectory=coverage \
        --ci \
        --runInBand \
        --detectOpenHandles \
        --forceExit \
        --maxWorkers="${MAX_WORKERS}" \
        --json \
        --outputFile="${JEST_JUNIT_OUTPUT_DIR}/jest-results.json" \
        --testTimeout="${TEST_TIMEOUT}" \
        || return 1
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Check SLA (15 minutes = 900 seconds)
    if [ $duration -gt 900 ]; then
        log "${RED}Warning: Test execution exceeded SLA (${duration}s > 900s)${NC}"
    fi
    
    log "${GREEN}Unit tests completed in ${duration}s${NC}"
    return 0
}

# Run E2E tests
run_e2e_tests() {
    log "${YELLOW}Running E2E tests...${NC}"
    
    local retry_count=0
    local success=false
    
    while [ $retry_count -lt $TEST_RETRY_COUNT ] && [ "$success" = false ]; do
        if npx jest \
            --config=test/jest-e2e.json \
            --detectOpenHandles \
            --forceExit \
            --maxWorkers="${MAX_WORKERS}" \
            --testTimeout="${TEST_TIMEOUT}" \
            --json \
            --outputFile="${JEST_JUNIT_OUTPUT_DIR}/jest-e2e-results.json"; then
            success=true
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $TEST_RETRY_COUNT ]; then
                log "${YELLOW}Retrying E2E tests (Attempt $((retry_count + 1))/${TEST_RETRY_COUNT})...${NC}"
                sleep 5
            fi
        fi
    done
    
    if [ "$success" = false ]; then
        log "${RED}E2E tests failed after ${TEST_RETRY_COUNT} attempts${NC}"
        return 1
    fi
    
    log "${GREEN}E2E tests completed successfully${NC}"
    return 0
}

# Check coverage thresholds
check_coverage() {
    log "${YELLOW}Checking test coverage...${NC}"
    
    local coverage_file="coverage/coverage-summary.json"
    
    if [[ ! -f "$coverage_file" ]]; then
        log "${RED}Coverage file not found${NC}"
        return 1
    }
    
    # Extract coverage percentages
    local branch_coverage=$(jq '.total.branches.pct' "$coverage_file")
    local function_coverage=$(jq '.total.functions.pct' "$coverage_file")
    local line_coverage=$(jq '.total.lines.pct' "$coverage_file")
    local statement_coverage=$(jq '.total.statements.pct' "$coverage_file")
    
    # Check against threshold
    local failed=false
    
    if (( $(echo "$branch_coverage < $COVERAGE_THRESHOLD" | bc -l) )); then
        log "${RED}Branch coverage ($branch_coverage%) below threshold ($COVERAGE_THRESHOLD%)${NC}"
        failed=true
    fi
    
    if (( $(echo "$function_coverage < $COVERAGE_THRESHOLD" | bc -l) )); then
        log "${RED}Function coverage ($function_coverage%) below threshold ($COVERAGE_THRESHOLD%)${NC}"
        failed=true
    fi
    
    if (( $(echo "$line_coverage < $COVERAGE_THRESHOLD" | bc -l) )); then
        log "${RED}Line coverage ($line_coverage%) below threshold ($COVERAGE_THRESHOLD%)${NC}"
        failed=true
    fi
    
    if (( $(echo "$statement_coverage < $COVERAGE_THRESHOLD" | bc -l) )); then
        log "${RED}Statement coverage ($statement_coverage%) below threshold ($COVERAGE_THRESHOLD%)${NC}"
        failed=true
    fi
    
    if [ "$failed" = true ]; then
        return 1
    fi
    
    log "${GREEN}Coverage check passed${NC}"
    return 0
}

# Cleanup function
cleanup() {
    log "${YELLOW}Cleaning up test environment...${NC}"
    
    # Compress test results
    if [ -d "${JEST_JUNIT_OUTPUT_DIR}" ]; then
        tar -czf test-results.tar.gz "${JEST_JUNIT_OUTPUT_DIR}"
    fi
    
    # Compress coverage reports
    if [ -d "coverage" ]; then
        tar -czf coverage-report.tar.gz coverage
    fi
    
    log "${GREEN}Cleanup completed${NC}"
    return 0
}

# Main execution
main() {
    log "${YELLOW}Starting test execution...${NC}"
    
    # Setup environment
    setup_environment || exit 1
    
    # Run tests
    run_unit_tests || exit 1
    run_e2e_tests || exit 1
    
    # Check coverage
    check_coverage || exit 1
    
    # Cleanup
    cleanup || exit 1
    
    log "${GREEN}All tests completed successfully${NC}"
    exit 0
}

# Execute main function
main