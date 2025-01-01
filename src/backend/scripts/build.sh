#!/bin/bash

# Set strict error handling
set -euo pipefail

# Global variables
readonly BUILD_DIR="./dist"
readonly LOG_DIR="./logs/build"
readonly BACKUP_DIR="./backup"
readonly BUILD_START_TIME=$(date +%s)
readonly SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
readonly PROJECT_ROOT="$SCRIPT_DIR/.."

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Initialize build environment and logging
initialize_build() {
    echo "🚀 Initializing build process..."
    
    # Create necessary directories
    mkdir -p "${LOG_DIR}" "${BACKUP_DIR}"
    
    # Initialize build log
    readonly BUILD_LOG="${LOG_DIR}/build_$(date +%Y%m%d_%H%M%S).log"
    exec 3>&1 4>&2
    trap 'exec 2>&4 1>&3' 0 1 2 3
    exec 1>"${BUILD_LOG}" 2>&1
    
    # Set up error handling
    trap 'error_handler $? $LINENO $BASH_LINENO "$BASH_COMMAND" $(printf "::%s" ${FUNCNAME[@]:-})' ERR
    
    echo "Build initialization complete. Log file: ${BUILD_LOG}"
}

# Error handler function
error_handler() {
    local exit_code=$1
    local line_no=$2
    local bash_lineno=$3
    local last_command=$4
    local func_trace=$5
    
    echo -e "${RED}Error occurred in build script${NC}"
    echo "Exit code: $exit_code"
    echo "Line number: $line_no"
    echo "Command: $last_command"
    echo "Function trace: $func_trace"
    
    # Cleanup on error
    cleanup_on_error
    
    exit "$exit_code"
}

# Cleanup function for error cases
cleanup_on_error() {
    echo "Cleaning up after build error..."
    [ -d "${BUILD_DIR}.tmp" ] && rm -rf "${BUILD_DIR}.tmp"
    [ -f "${BUILD_DIR}.lock" ] && rm -f "${BUILD_DIR}.lock"
}

# Check Node.js version
check_node_version() {
    echo "Checking Node.js version..."
    
    # Extract required version from package.json
    local required_version
    required_version=$(node -p "require('${PROJECT_ROOT}/package.json').engines.node.replace('>=', '')")
    local current_version
    current_version=$(node -v | cut -d 'v' -f 2)
    
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}Node.js is not installed${NC}" >&2
        return 1
    fi
    
    if ! node -e "process.exit(require('semver').gte('$current_version', '$required_version') ? 0 : 1)"; then
        echo -e "${RED}Node.js version $required_version or higher is required. Current version: $current_version${NC}" >&2
        return 1
    fi
    
    echo -e "${GREEN}Node.js version check passed${NC}"
}

# Clean build directory
clean_build() {
    echo "Cleaning build directory..."
    
    # Create backup of existing build if present
    if [ -d "${BUILD_DIR}" ]; then
        local backup_name="build_$(date +%Y%m%d_%H%M%S)"
        mv "${BUILD_DIR}" "${BACKUP_DIR}/${backup_name}"
        echo "Previous build backed up to ${BACKUP_DIR}/${backup_name}"
    fi
    
    # Clean and create build directory
    rm -rf "${BUILD_DIR}" "${BUILD_DIR}.tmp"
    mkdir -p "${BUILD_DIR}"
    
    echo -e "${GREEN}Build directory cleaned${NC}"
}

# Install production dependencies
install_dependencies() {
    echo "Installing production dependencies..."
    
    # Verify package-lock.json exists
    if [ ! -f "${PROJECT_ROOT}/package-lock.json" ]; then
        echo -e "${RED}package-lock.json not found${NC}" >&2
        return 1
    fi
    
    # Install dependencies with retry mechanism
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt of $max_attempts..."
        if npm ci --production --no-optional; then
            echo -e "${GREEN}Dependencies installed successfully${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 5
    done
    
    echo -e "${RED}Failed to install dependencies after $max_attempts attempts${NC}" >&2
    return 1
}

# Build TypeScript
build_typescript() {
    echo "Building TypeScript..."
    
    # Set Node.js memory limit for large projects
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    # Run TypeScript compilation
    if ! npm run build; then
        echo -e "${RED}TypeScript build failed${NC}" >&2
        return 1
    fi
    
    echo -e "${GREEN}TypeScript build completed${NC}"
}

# Optimize build output
optimize_build() {
    echo "Optimizing build..."
    
    # Remove source maps in production
    if [ "${NODE_ENV:-}" = "production" ]; then
        find "${BUILD_DIR}" -name "*.js.map" -type f -delete
        echo "Source maps removed for production build"
    fi
    
    # Generate build metadata
    cat > "${BUILD_DIR}/build-info.json" << EOF
{
    "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "nodeVersion": "$(node -v)",
    "gitCommit": "$(git rev-parse HEAD)",
    "buildNumber": "${BUILD_NUMBER:-local}"
}
EOF
    
    echo -e "${GREEN}Build optimization completed${NC}"
}

# Finalize build
finalize_build() {
    echo "Finalizing build..."
    
    # Calculate build duration
    local build_end_time
    build_end_time=$(date +%s)
    local build_duration=$((build_end_time - BUILD_START_TIME))
    
    # Generate build report
    cat > "${LOG_DIR}/build_report.txt" << EOF
Build Report
===========
Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Duration: ${build_duration} seconds
Node Version: $(node -v)
Build Directory Size: $(du -sh "${BUILD_DIR}" | cut -f1)
EOF
    
    echo -e "${GREEN}Build completed successfully in ${build_duration} seconds${NC}"
}

# Main execution
main() {
    echo "Starting build process..."
    
    initialize_build
    check_node_version
    clean_build
    install_dependencies
    build_typescript
    optimize_build
    finalize_build
    
    echo -e "${GREEN}Build completed successfully!${NC}"
}

# Execute main function
main "$@"