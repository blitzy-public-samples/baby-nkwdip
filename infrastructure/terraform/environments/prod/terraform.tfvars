# AWS Regions Configuration
# Primary: US East (N. Virginia), Secondary: US West (Oregon), DR: EU Central (Frankfurt)
aws_regions = ["us-east-1", "us-west-2", "eu-central-1"]

# VPC CIDR Block Assignments - Non-overlapping ranges for proper network segmentation
vpc_cidr_blocks = {
  us-east-1    = "10.0.0.0/16"  # Primary region
  us-west-2    = "10.1.0.0/16"  # Secondary region
  eu-central-1 = "10.2.0.0/16"  # DR region
}

# ECS Cluster Configuration - Production grade settings with high availability
ecs_cluster_settings = {
  us-east-1 = {
    min_capacity               = 3
    max_capacity              = 6
    instance_type             = "t3.medium"
    desired_count             = 3
    cpu_threshold             = 70
    memory_threshold          = 80
    health_check_grace_period = 300
    container_insights        = true
  }
  us-west-2 = {
    min_capacity               = 3
    max_capacity              = 6
    instance_type             = "t3.medium"
    desired_count             = 3
    cpu_threshold             = 70
    memory_threshold          = 80
    health_check_grace_period = 300
    container_insights        = true
  }
  eu-central-1 = {
    min_capacity               = 2
    max_capacity              = 4
    instance_type             = "t3.medium"
    desired_count             = 2
    cpu_threshold             = 70
    memory_threshold          = 80
    health_check_grace_period = 300
    container_insights        = true
  }
}

# RDS Configuration - High availability database settings
rds_settings = {
  us-east-1 = {
    instance_class               = "db.r6g.large"
    allocated_storage           = 100
    max_allocated_storage       = 1000
    multi_az                    = true
    backup_retention_period     = 30
    deletion_protection         = true
    performance_insights_enabled = true
    monitoring_interval         = 60
  }
  us-west-2 = {
    instance_class               = "db.r6g.large"
    allocated_storage           = 100
    max_allocated_storage       = 1000
    multi_az                    = true
    backup_retention_period     = 30
    deletion_protection         = true
    performance_insights_enabled = true
    monitoring_interval         = 60
  }
  eu-central-1 = {
    instance_class               = "db.r6g.large"
    allocated_storage           = 100
    max_allocated_storage       = 1000
    multi_az                    = true
    backup_retention_period     = 30
    deletion_protection         = true
    performance_insights_enabled = true
    monitoring_interval         = 60
  }
}

# Enable Container Insights for enhanced monitoring
enable_container_insights = true

# Resource Tags - Comprehensive tagging strategy for compliance and management
tags = {
  Environment          = "production"
  Project             = "BabyCryAnalyzer"
  ManagedBy           = "Terraform"
  SecurityCompliance  = "HIPAA-GDPR-SOC2-COPPA"
  DataClassification  = "Sensitive"
  BackupSchedule      = "Daily"
  RetentionPeriod     = "90days"
  DisasterRecovery    = "Enabled"
  HighAvailability    = "Multi-Region"
  CostCenter          = "PROD-BCA-001"
  SecurityContact     = "security@babycryanalyzer.com"
  DataResidency       = "Multi-Region"
  EncryptionRequired  = "True"
  ComplianceAudit     = "Required"
  MonitoringLevel     = "Enhanced"
}