#!/bin/bash

# Baby Cry Analyzer - Monitoring Infrastructure Setup Script
# Version: 1.0.0
# Dependencies:
# - kubectl v1.24+
# - prometheus v2.40+
# - grafana v9.0+
# - alertmanager v0.25+
# - newrelic-cli v3.x

set -euo pipefail

# Global Variables
MONITORING_NAMESPACE="monitoring"
APP_NAMESPACE="baby-cry-analyzer"
GRAFANA_VERSION="9.0.0"
PROMETHEUS_VERSION="2.40.0"
ALERTMANAGER_VERSION="0.25.0"
REGIONS=("us-east" "us-west" "eu-central")
SLA_TARGET="99.99"
METRIC_RETENTION_DAYS="90"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if monitoring prerequisites are met
check_monitoring_prerequisites() {
    local NAMESPACE=$1
    local ENVIRONMENT=$2
    local REGIONS=$3
    
    log_info "Checking monitoring prerequisites for environment: $ENVIRONMENT"
    
    # Check Prometheus operator
    for region in ${REGIONS[@]}; do
        if ! kubectl get prometheusoperators -n "$NAMESPACE" --context "$region" &>/dev/null; then
            log_error "Prometheus operator not found in region $region"
            return 1
        fi
    done
    
    # Verify ServiceMonitor CRD
    if ! kubectl get crd servicemonitors.monitoring.coreos.com &>/dev/null; then
        log_error "ServiceMonitor CRD not found"
        return 1
    fi
    
    # Check Grafana operator
    if ! kubectl get deployment grafana-operator -n "$NAMESPACE" &>/dev/null; then
        log_error "Grafana operator not found"
        return 1
    }
    
    # Validate RBAC permissions
    if ! kubectl auth can-i get servicemonitors -n "$NAMESPACE"; then
        log_error "Insufficient RBAC permissions"
        return 1
    fi
    
    log_info "All prerequisites checked successfully"
    return 0
}

# Setup Prometheus monitoring
setup_prometheus_monitoring() {
    local NAMESPACE=$1
    local APP_NAME=$2
    local REGIONS=$3
    
    log_info "Setting up Prometheus monitoring for $APP_NAME"
    
    # Create ServiceMonitor for backend service
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: $NAMESPACE
spec:
  selector:
    matchLabels:
      app: baby-cry-analyzer
      component: backend
  endpoints:
  - port: metrics
    path: /metrics
    interval: 15s
    scrapeTimeout: 10s
EOF
    
    # Create ServiceMonitor for ML service
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ml-monitor
  namespace: $NAMESPACE
spec:
  selector:
    matchLabels:
      app: baby-cry-analyzer
      component: ml
  endpoints:
  - port: metrics
    path: /metrics
    interval: 15s
    scrapeTimeout: 10s
    metricRelabelings:
    - sourceLabels: [__name__]
      regex: 'ml_model_.*'
      action: keep
EOF
    
    # Configure federation
    for region in ${REGIONS[@]}; do
        kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: federation-rules
  namespace: $NAMESPACE
spec:
  groups:
  - name: federation
    interval: 30s
    rules:
    - record: region:sla:uptime
      expr: avg_over_time(up{job="baby-cry-analyzer"}[5m])
EOF
    done
    
    log_info "Prometheus monitoring setup completed"
    return 0
}

# Configure Grafana dashboards
configure_grafana_dashboards() {
    local NAMESPACE=$1
    local DASHBOARD_DIR=$2
    local REGIONS=$3
    
    log_info "Configuring Grafana dashboards"
    
    # Create cross-region overview dashboard
    cat <<EOF | kubectl apply -f -
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDashboard
metadata:
  name: cross-region-overview
  namespace: $NAMESPACE
spec:
  json: |
    {
      "title": "Cross-Region Overview",
      "panels": [
        {
          "title": "Regional SLA Status",
          "type": "gauge",
          "datasource": "Prometheus",
          "targets": [
            {
              "expr": "region:sla:uptime * 100"
            }
          ]
        }
      ]
    }
EOF
    
    # Create ML performance dashboard
    cat <<EOF | kubectl apply -f -
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDashboard
metadata:
  name: ml-performance
  namespace: $NAMESPACE
spec:
  json: |
    {
      "title": "ML Performance Metrics",
      "panels": [
        {
          "title": "Model Accuracy",
          "type": "graph",
          "datasource": "Prometheus",
          "targets": [
            {
              "expr": "ml_model_accuracy"
            }
          ]
        }
      ]
    }
EOF
    
    log_info "Grafana dashboards configured successfully"
    return 0
}

# Setup alerting rules
setup_alerting_rules() {
    local NAMESPACE=$1
    local ENVIRONMENT=$2
    local REGIONS=$3
    
    log_info "Setting up alerting rules for $ENVIRONMENT"
    
    # Create AlertManager config
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: baby-cry-analyzer-alerts
  namespace: $NAMESPACE
spec:
  groups:
  - name: ml.rules
    rules:
    - alert: MLModelAccuracyDrop
      expr: ml_model_accuracy < 0.90
      for: 5m
      labels:
        severity: critical
        component: ml
      annotations:
        summary: "ML model accuracy below threshold"
        
  - name: sla.rules
    rules:
    - alert: SLABreach
      expr: region:sla:uptime * 100 < $SLA_TARGET
      for: 5m
      labels:
        severity: critical
        component: sla
      annotations:
        summary: "SLA breach detected"
EOF
    
    # Configure notification channels
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: AlertmanagerConfig
metadata:
  name: alert-channels
  namespace: $NAMESPACE
spec:
  route:
    receiver: 'default'
    routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
  receivers:
  - name: 'default'
    emailConfigs:
    - to: 'alerts@babycryanalyzer.com'
  - name: 'pagerduty'
    pagerdutyConfigs:
    - serviceKey: '${PAGERDUTY_KEY}'
EOF
    
    log_info "Alert rules configured successfully"
    return 0
}

# Main execution
main() {
    local COMMAND=$1
    shift
    
    case $COMMAND in
        "check")
            check_monitoring_prerequisites "$@"
            ;;
        "prometheus")
            setup_prometheus_monitoring "$@"
            ;;
        "grafana")
            configure_grafana_dashboards "$@"
            ;;
        "alerts")
            setup_alerting_rules "$@"
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            exit 1
            ;;
    esac
}

# Execute if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        log_error "Usage: $0 {check|prometheus|grafana|alerts} [args...]"
        exit 1
    fi
    
    main "$@"
fi