# Terraform version constraint
terraform {
  required_version = "~> 1.0"
}

# Environment variable with strict validation
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod) with security constraints"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# AWS regions configuration for multi-region deployment
variable "aws_regions" {
  type        = list(string)
  description = "Ordered list of AWS regions for multi-region deployment (primary, secondary, DR)"
  default     = ["us-east-1", "us-west-2", "eu-central-1"]

  validation {
    condition     = length(var.aws_regions) >= 1
    error_message = "At least one AWS region must be specified."
  }
}

# VPC and subnet CIDR configurations
variable "vpc_cidr_blocks" {
  type = map(object({
    cidr              = string
    public_subnets    = list(string)
    private_subnets   = list(string)
    database_subnets  = list(string)
  }))
  description = "Region-specific VPC and subnet CIDR configurations with network segmentation"

  validation {
    condition     = alltrue([for k, v in var.vpc_cidr_blocks : can(cidrhost(v.cidr, 0))])
    error_message = "All VPC CIDR blocks must be valid IPv4 CIDR notation."
  }
}

# ECS cluster configuration
variable "ecs_cluster_settings" {
  type = map(object({
    instance_type      = string
    min_size          = number
    max_size          = number
    desired_capacity  = number
    container_insights = bool
  }))
  description = "ECS cluster configuration with auto-scaling and monitoring settings per region"

  validation {
    condition     = alltrue([for k, v in var.ecs_cluster_settings : v.min_size <= v.desired_capacity && v.desired_capacity <= v.max_size])
    error_message = "ECS cluster capacity values must satisfy: min_size <= desired_capacity <= max_size."
  }
}

# RDS configuration with security settings
variable "rds_settings" {
  type = map(object({
    instance_class      = string
    allocated_storage  = number
    multi_az          = bool
    backup_retention  = number
    encryption_key_arn = string
  }))
  description = "RDS instance configuration with security and compliance settings"

  validation {
    condition     = alltrue([for k, v in var.rds_settings : v.backup_retention >= 7])
    error_message = "RDS backup retention period must be at least 7 days for compliance."
  }
}

# Compliance and security tags
variable "compliance_tags" {
  type = map(object({
    data_classification = string
    compliance_level   = string
    encryption_required = bool
  }))
  description = "Compliance-specific resource tagging for security and regulatory requirements"

  validation {
    condition     = alltrue([for k, v in var.compliance_tags : contains(["public", "internal", "confidential", "restricted"], v.data_classification)])
    error_message = "Data classification must be one of: public, internal, confidential, restricted."
  }
}

# Monitoring and alerting configuration
variable "monitoring_settings" {
  type = map(object({
    metrics_retention = number
    log_retention    = number
    alert_endpoints  = list(string)
  }))
  description = "Monitoring and alerting configuration for infrastructure oversight"

  validation {
    condition     = alltrue([for k, v in var.monitoring_settings : v.log_retention >= 90])
    error_message = "Log retention must be at least 90 days for compliance requirements."
  }
}

# High availability settings
variable "high_availability_settings" {
  type = map(object({
    failover_enabled    = bool
    replication_enabled = bool
    backup_regions     = list(string)
    rto_minutes       = number
    rpo_minutes       = number
  }))
  description = "High availability and disaster recovery configuration settings"

  validation {
    condition     = alltrue([for k, v in var.high_availability_settings : v.rto_minutes <= 60 && v.rpo_minutes <= 15])
    error_message = "RTO must be <= 60 minutes and RPO must be <= 15 minutes for high availability requirements."
  }
}