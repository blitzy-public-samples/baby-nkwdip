# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9.0"
    }
  }

  backend "s3" {
    bucket         = "bca-terraform-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "bca-terraform-locks"
  }
}

# Local variables for common configuration
locals {
  environment = "prod"
  regions = {
    primary   = "us-east-1"
    secondary = "us-west-2"
    dr        = "eu-central-1"
  }
  common_tags = {
    Environment         = "production"
    Project            = "BabyCryAnalyzer"
    ManagedBy          = "Terraform"
    SecurityCompliance = "HIPAA-GDPR-SOC2"
    DataClassification = "Sensitive"
    BackupFrequency    = "Daily"
    DisasterRecoveryTier = "Tier1"
  }
}

# Provider configuration for each region
provider "aws" {
  alias  = "primary"
  region = local.regions.primary
  default_tags {
    tags = local.common_tags
  }
  
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/BCAProductionDeployment"
  }
}

provider "aws" {
  alias  = "secondary"
  region = local.regions.secondary
  default_tags {
    tags = local.common_tags
  }
  
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/BCAProductionDeployment"
  }
}

provider "aws" {
  alias  = "dr"
  region = local.regions.dr
  default_tags {
    tags = local.common_tags
  }
  
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/BCAProductionDeployment"
  }
}

# VPC module for each region
module "vpc_primary" {
  source = "../../modules/vpc"
  providers = {
    aws = aws.primary
  }

  vpc_cidr             = "10.0.0.0/16"
  environment          = local.environment
  availability_zones   = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_count  = 3
  private_subnet_count = 3
  enable_nat_gateway   = true
  enable_vpn_gateway   = true
  tags                 = local.common_tags
}

module "vpc_secondary" {
  source = "../../modules/vpc"
  providers = {
    aws = aws.secondary
  }

  vpc_cidr             = "10.1.0.0/16"
  environment          = local.environment
  availability_zones   = ["us-west-2a", "us-west-2b", "us-west-2c"]
  public_subnet_count  = 3
  private_subnet_count = 3
  enable_nat_gateway   = true
  enable_vpn_gateway   = true
  tags                 = local.common_tags
}

module "vpc_dr" {
  source = "../../modules/vpc"
  providers = {
    aws = aws.dr
  }

  vpc_cidr             = "10.2.0.0/16"
  environment          = local.environment
  availability_zones   = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]
  public_subnet_count  = 3
  private_subnet_count = 3
  enable_nat_gateway   = true
  enable_vpn_gateway   = true
  tags                 = local.common_tags
}

# ECS module for each region
module "ecs_primary" {
  source = "../../modules/ecs"
  providers = {
    aws = aws.primary
  }

  environment         = local.environment
  vpc_id             = module.vpc_primary.vpc_id
  private_subnet_ids = module.vpc_primary.private_subnet_ids
  tags               = local.common_tags
}

module "ecs_secondary" {
  source = "../../modules/ecs"
  providers = {
    aws = aws.secondary
  }

  environment         = local.environment
  vpc_id             = module.vpc_secondary.vpc_id
  private_subnet_ids = module.vpc_secondary.private_subnet_ids
  tags               = local.common_tags
}

module "ecs_dr" {
  source = "../../modules/ecs"
  providers = {
    aws = aws.dr
  }

  environment         = local.environment
  vpc_id             = module.vpc_dr.vpc_id
  private_subnet_ids = module.vpc_dr.private_subnet_ids
  tags               = local.common_tags
}

# Route 53 health checks for failover
resource "aws_route53_health_check" "primary" {
  provider = aws.primary

  fqdn              = "api.primary.babycryanalyzer.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(local.common_tags, {
    Name = "bca-primary-health-check"
  })
}

# Cross-region replication for critical data
resource "aws_s3_bucket" "replication" {
  provider = aws.primary
  for_each = local.regions

  bucket = "bca-replication-${each.key}"
  
  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "aws:kms"
      }
    }
  }

  tags = merge(local.common_tags, {
    Region = each.key
  })
}

# CloudWatch alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "service_health" {
  provider = aws.primary
  for_each = toset(["api", "auth", "ml", "analysis"])

  alarm_name          = "bca-${each.key}-health-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "HealthyHostCount"
  namespace          = "AWS/ApplicationELB"
  period             = "60"
  statistic          = "Average"
  threshold          = "1"
  alarm_description  = "This metric monitors ${each.key} service health"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, {
    Service = each.key
  })
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  provider = aws.primary
  name     = "bca-alerts-${local.environment}"
  
  kms_master_key_id = "alias/aws/sns"

  tags = local.common_tags
}

# Outputs for reference
output "vpc_ids" {
  description = "VPC IDs for each region"
  value = {
    primary   = module.vpc_primary.vpc_id
    secondary = module.vpc_secondary.vpc_id
    dr        = module.vpc_dr.vpc_id
  }
}

output "ecs_cluster_arns" {
  description = "ECS Cluster ARNs for each region"
  value = {
    primary   = module.ecs_primary.cluster_arn
    secondary = module.ecs_secondary.cluster_arn
    dr        = module.ecs_dr.cluster_arn
  }
}