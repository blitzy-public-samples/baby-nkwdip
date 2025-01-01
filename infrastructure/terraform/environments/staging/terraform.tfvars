# Environment identifier
environment = "staging"

# AWS region configuration for staging (single region)
aws_regions = ["us-east-1"]

# VPC and subnet CIDR configuration with network isolation
vpc_cidr_blocks = {
  "us-east-1" = {
    cidr = "10.1.0.0/16"
    public_subnets    = ["10.1.0.0/24", "10.1.1.0/24"]
    private_subnets   = ["10.1.10.0/24", "10.1.11.0/24"]
    database_subnets  = ["10.1.20.0/24", "10.1.21.0/24"]
  }
}

# ECS cluster configuration with service-specific scaling
ecs_cluster_settings = {
  "us-east-1" = {
    instance_type      = "t3.medium"
    min_size          = 2
    max_size          = 4
    desired_capacity  = 2
    container_insights = true
  }
}

# RDS configuration with enhanced security
rds_settings = {
  "us-east-1" = {
    instance_class     = "db.t3.medium"
    allocated_storage = 100
    multi_az         = true
    backup_retention = 14
    encryption_key_arn = "arn:aws:kms:us-east-1:${data.aws_caller_identity.current.account_id}:key/staging-rds-key"
  }
}

# WAF rules configuration
waf_rules = {
  rate_limit = {
    limit = 2000
    time_window = 300
  }
  ip_rate_limit = {
    limit = 100
    time_window = 300
  }
  security_rules = {
    enable_sql_injection_protection = true
    enable_xss_protection = true
    enable_bad_bot_protection = true
  }
}

# Backup configuration for compliance
backup_settings = {
  database = {
    retention_days = 30
    backup_window = "03:00-04:00"
    snapshot_count = 7
  }
  application_data = {
    retention_days = 30
    schedule_expression = "cron(0 3 ? * * *)"
  }
}

# Enhanced monitoring configuration
monitoring_settings = {
  "us-east-1" = {
    metrics_retention = 90
    log_retention    = 90
    alert_endpoints  = ["ops@babycryanalyzer-staging.com"]
    alarm_thresholds = {
      cpu_utilization    = 70
      memory_utilization = 80
      error_rate        = 1
      latency_p95       = 500
    }
  }
}

# Enable container insights for enhanced monitoring
enable_container_insights = true

# Resource tagging for compliance and security
tags = {
  Environment          = "staging"
  Application         = "baby-cry-analyzer"
  DataClassification  = "confidential"
  ComplianceLevel     = "hipaa-gdpr-coppa"
  SecurityZone        = "restricted"
  BackupPolicy       = "daily"
  EncryptionRequired = "true"
  MonitoringLevel    = "enhanced"
  CostCenter         = "staging-ops"
  Owner              = "platform-team"
}

# Service-specific task configurations
service_task_config = {
  api_service = {
    cpu = 512
    memory = 1024
    min_tasks = 2
    max_tasks = 4
    scaling_cpu_threshold = 70
  }
  ml_service = {
    cpu = 1024
    memory = 2048
    min_tasks = 2
    max_tasks = 4
    scaling_cpu_threshold = 60
  }
  analysis_service = {
    cpu = 1024
    memory = 2048
    min_tasks = 2
    max_tasks = 4
    scaling_cpu_threshold = 70
  }
}

# Security group rules with strict access control
security_group_rules = {
  alb = {
    ingress = {
      http = {
        from_port = 80
        to_port = 80
        cidr_blocks = ["0.0.0.0/0"]
        description = "HTTP from public"
      }
      https = {
        from_port = 443
        to_port = 443
        cidr_blocks = ["0.0.0.0/0"]
        description = "HTTPS from public"
      }
    }
  }
  ecs = {
    ingress = {
      alb = {
        from_port = 3000
        to_port = 3000
        source_security_group_id = "alb"
        description = "Traffic from ALB"
      }
    }
  }
  rds = {
    ingress = {
      postgres = {
        from_port = 5432
        to_port = 5432
        source_security_group_id = "ecs"
        description = "PostgreSQL from ECS"
      }
    }
  }
}