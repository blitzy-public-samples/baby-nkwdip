# Environment identifier
environment = "dev"

# Application name
app_name = "baby-cry-analyzer"

# Development region VPC CIDR blocks
vpc_cidr_blocks = {
  "us-east-1" = {
    cidr = "10.0.0.0/16"
    public_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
    private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
    database_subnets = ["10.0.20.0/24", "10.0.21.0/24"]
  }
}

# ECS cluster settings for development services
ecs_cluster_settings = {
  api_service = {
    instance_type = "t3.medium"
    min_size = 1
    max_size = 3
    desired_capacity = 2
    container_insights = true
  }
  ml_service = {
    instance_type = "t3.large"
    min_size = 1
    max_size = 2
    desired_capacity = 1
    container_insights = true
  }
  analysis_service = {
    instance_type = "t3.medium"
    min_size = 1
    max_size = 2
    desired_capacity = 1
    container_insights = true
  }
}

# RDS settings for development database
rds_settings = {
  instance_class = "db.t3.medium"
  allocated_storage = 20
  multi_az = false
  backup_retention_period = 7
  encryption_key_arn = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/dev-rds-key"
}

# Enable container insights for development monitoring
enable_container_insights = true

# Security settings for development environment
security_settings = {
  encryption_enabled = true
  log_retention_days = 90
  alert_endpoints = ["dev-team@example.com"]
}

# Resource tagging for development environment
tags = {
  Environment = "development"
  Project = "baby-cry-analyzer"
  ManagedBy = "terraform"
  DataClassification = "internal"
  ComplianceLevel = "development"
}

# Monitoring configuration for development
monitoring_settings = {
  metrics_retention_days = 90
  log_retention_days = 90
  alert_thresholds = {
    cpu_utilization = 80
    memory_utilization = 80
    api_latency_ms = 1000
  }
}

# High availability settings for development (minimal for cost optimization)
high_availability_settings = {
  failover_enabled = false
  replication_enabled = false
  backup_regions = []
  rto_minutes = 60
  rpo_minutes = 15
}

# Compliance and security tags for development
compliance_tags = {
  data_classification = "internal"
  compliance_level = "development"
  encryption_required = true
}

# Development-specific feature flags
feature_flags = {
  enable_detailed_monitoring = true
  enable_backup = true
  enable_ssl = true
  enable_waf = false
}