# Provider configuration with enhanced security features
terraform {
  required_version = ">= 1.0.0"

  backend "s3" {
    bucket         = "baby-cry-analyzer-staging-tf-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Local variables for environment configuration
locals {
  environment = "staging"
  aws_region  = "us-east-1"
  common_tags = {
    Environment        = "staging"
    Project           = "BabyCryAnalyzer"
    ManagedBy         = "Terraform"
    ComplianceLevel   = "HIPAA-GDPR-SOC2"
    DataClassification = "Sensitive"
    BackupRetention   = "30days"
  }

  # VPC Configuration
  vpc_config = {
    cidr_block           = "10.1.0.0/16"
    availability_zones   = ["us-east-1a", "us-east-1b", "us-east-1c"]
    public_subnet_count  = 3
    private_subnet_count = 3
    enable_nat_gateway   = true
    enable_vpn_gateway   = false
  }
}

# AWS Provider configuration
provider "aws" {
  region = local.aws_region
  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformDeploymentRole"
  }
}

# Data sources
data "aws_caller_identity" "current" {}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr             = local.vpc_config.cidr_block
  environment          = local.environment
  availability_zones   = local.vpc_config.availability_zones
  public_subnet_count  = local.vpc_config.public_subnet_count
  private_subnet_count = local.vpc_config.private_subnet_count
  enable_nat_gateway   = local.vpc_config.enable_nat_gateway
  enable_vpn_gateway   = local.vpc_config.enable_vpn_gateway
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    SecurityCompliance = "HIPAA-GDPR-SOC2"
    DataClassification = "Sensitive"
  })
}

# ECS Module
module "ecs" {
  source = "../../modules/ecs"

  environment         = local.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  depends_on = [module.vpc]
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_utilization" {
  alarm_name          = "staging-ecs-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period             = "300"
  statistic          = "Average"
  threshold          = "75"
  alarm_description  = "This metric monitors ECS CPU utilization"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = module.ecs.cluster_arn
  }

  tags = local.common_tags
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name              = "staging-alerts"
  kms_master_key_id = aws_kms_key.sns.id

  tags = local.common_tags
}

# KMS Key for SNS encryption
resource "aws_kms_key" "sns" {
  description             = "KMS key for SNS topic encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID for staging environment"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN for staging environment"
  value       = module.ecs.cluster_arn
}

output "private_subnet_ids" {
  description = "Private subnet IDs for service deployment"
  value       = module.vpc.private_subnet_ids
  sensitive   = true
}

output "monitoring_endpoints" {
  description = "Endpoints for monitoring and logging services"
  value = {
    cloudwatch_log_group = "/aws/ecs/staging"
    sns_topic           = aws_sns_topic.alerts.arn
  }
  sensitive = true
}