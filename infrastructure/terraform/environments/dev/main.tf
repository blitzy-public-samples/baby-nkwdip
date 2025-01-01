# Provider and backend configuration for development environment
terraform {
  required_version = ">= 1.0.0"

  backend "s3" {
    bucket         = "baby-cry-analyzer-dev-tfstate"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock-dev"
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

# Local variables for development environment
locals {
  environment = "dev"
  aws_region  = "us-east-1"
  common_tags = {
    Environment     = "Development"
    Project         = "BabyCryAnalyzer"
    ManagedBy       = "Terraform"
    CostCenter      = "Development"
    AutoShutdown    = "true"
    SecurityLevel   = "Development"
  }

  # Development-specific VPC configuration
  vpc_config = {
    cidr_block           = "10.0.0.0/16"
    public_subnet_count  = 2
    private_subnet_count = 2
    availability_zones   = ["us-east-1a", "us-east-1b"]
    enable_nat_gateway   = true
    enable_vpn_gateway   = false
  }

  # Development-specific ECS configuration
  ecs_config = {
    cluster_name = "bca-dev-cluster"
    services = {
      api = {
        min_capacity  = 1
        max_capacity  = 2
        cpu          = 256
        memory       = 512
      }
      auth = {
        min_capacity  = 1
        max_capacity  = 2
        cpu          = 256
        memory       = 512
      }
      ml = {
        min_capacity  = 1
        max_capacity  = 2
        cpu          = 512
        memory       = 1024
      }
      analysis = {
        min_capacity  = 1
        max_capacity  = 2
        cpu          = 512
        memory       = 1024
      }
    }
  }
}

# AWS Provider configuration
provider "aws" {
  region = local.aws_region
  
  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-dev"
  }
}

# Data sources
data "aws_caller_identity" "current" {}

# VPC Module for development environment
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr             = local.vpc_config.cidr_block
  environment          = local.environment
  availability_zones   = local.vpc_config.availability_zones
  public_subnet_count  = local.vpc_config.public_subnet_count
  private_subnet_count = local.vpc_config.private_subnet_count
  enable_nat_gateway   = local.vpc_config.enable_nat_gateway
  enable_vpn_gateway   = local.vpc_config.enable_vpn_gateway
  
  tags = merge(local.common_tags, {
    SecurityCompliance = "Development"
    DataClassification = "Development"
  })
}

# ECS Module for development environment
module "ecs" {
  source = "../../modules/ecs"

  environment         = local.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  cluster_name = local.ecs_config.cluster_name
  services     = local.ecs_config.services
}

# CloudWatch Log Groups for development environment
resource "aws_cloudwatch_log_group" "dev_logs" {
  name              = "/aws/bca/${local.environment}"
  retention_in_days = 14

  tags = local.common_tags
}

# Development environment outputs
output "vpc_id" {
  description = "Development VPC ID"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_arn" {
  description = "Development ECS Cluster ARN"
  value       = module.ecs.cluster_arn
}

output "private_subnet_ids" {
  description = "Development private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "cloudwatch_log_groups" {
  description = "Development CloudWatch log group names"
  value       = [aws_cloudwatch_log_group.dev_logs.name]
}

# Development-specific security group
resource "aws_security_group" "dev_default" {
  name        = "bca-dev-default"
  description = "Default security group for development environment"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [local.vpc_config.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "bca-dev-default-sg"
  })
}