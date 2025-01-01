# Required Terraform version and provider configurations
terraform {
  required_version = ">= 1.0.0"
  
  backend "s3" {
    bucket         = "bca-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "bca-terraform-locks"
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

# Local variables for resource naming and tagging
locals {
  app_name = "bca"
  resource_prefix = "${local.app_name}-${var.environment}"
  
  common_tags = {
    Application = "Baby Cry Analyzer"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Merge compliance tags with common tags
  resource_tags = merge(local.common_tags, var.compliance_tags)

  # High availability configuration
  primary_region   = var.aws_regions[0]
  secondary_region = var.aws_regions[1]
  dr_region        = var.aws_regions[2]
}

# Multi-region VPC configuration
module "vpc" {
  for_each = toset(var.aws_regions)
  
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 3.0"
  
  name = "${local.resource_prefix}-vpc-${each.key}"
  cidr = var.vpc_cidr_blocks[each.key].cidr
  
  azs              = ["${each.key}a", "${each.key}b", "${each.key}c"]
  private_subnets  = var.vpc_cidr_blocks[each.key].private_subnets
  public_subnets   = var.vpc_cidr_blocks[each.key].public_subnets
  database_subnets = var.vpc_cidr_blocks[each.key].database_subnets
  
  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "prod"
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
  
  # VPC Flow Logs for security compliance
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true
  flow_log_max_aggregation_interval    = 60
  
  tags = merge(local.resource_tags, {
    Region = each.key
  })
}

# ECS Cluster configuration
module "ecs_cluster" {
  for_each = toset(var.aws_regions)
  
  source = "terraform-aws-modules/ecs/aws"
  
  cluster_name = "${local.resource_prefix}-cluster-${each.key}"
  
  cluster_configuration = {
    execute_command_configuration = {
      logging = "OVERRIDE"
      log_configuration = {
        cloud_watch_log_group_name = "/aws/ecs/${local.resource_prefix}-cluster-${each.key}"
      }
    }
  }
  
  # Capacity provider strategy
  fargate_capacity_providers = {
    FARGATE = {
      default_capacity_provider_strategy = {
        weight = 50
        base   = 20
      }
    }
    FARGATE_SPOT = {
      default_capacity_provider_strategy = {
        weight = 50
      }
    }
  }

  tags = merge(local.resource_tags, {
    Region = each.key
  })
}

# RDS Multi-region configuration
module "rds" {
  for_each = toset(var.aws_regions)
  
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 5.0"
  
  identifier = "${local.resource_prefix}-rds-${each.key}"
  
  engine               = "postgres"
  engine_version       = "14"
  family              = "postgres14"
  major_engine_version = "14"
  instance_class       = var.rds_settings[each.key].instance_class
  
  allocated_storage     = var.rds_settings[each.key].allocated_storage
  max_allocated_storage = var.rds_settings[each.key].allocated_storage * 2
  
  db_name  = "bcadb"
  username = "bcaadmin"
  port     = 5432
  
  multi_az               = var.rds_settings[each.key].multi_az
  db_subnet_group_name   = module.vpc[each.key].database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds[each.key].id]
  
  maintenance_window              = "Mon:00:00-Mon:03:00"
  backup_window                  = "03:00-06:00"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  backup_retention_period        = var.rds_settings[each.key].backup_retention
  
  # Encryption configuration
  storage_encrypted = true
  kms_key_id       = var.rds_settings[each.key].encryption_key_arn
  
  tags = merge(local.resource_tags, {
    Region = each.key
  })
}

# S3 Buckets with replication
module "s3_bucket" {
  for_each = toset(var.aws_regions)
  
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 3.0"
  
  bucket = "${local.resource_prefix}-storage-${each.key}"
  acl    = "private"
  
  versioning = {
    enabled = true
  }
  
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "aws:kms"
        kms_master_key_id = var.rds_settings[each.key].encryption_key_arn
      }
    }
  }
  
  # Lifecycle rules
  lifecycle_rule = [
    {
      id      = "audio_files"
      enabled = true
      prefix  = "audio/"
      
      transition = [
        {
          days          = 90
          storage_class = "STANDARD_IA"
        },
        {
          days          = 180
          storage_class = "GLACIER"
        }
      ]
      
      expiration = {
        days = 365
      }
    }
  ]
  
  # Replication configuration for DR
  dynamic "replication_configuration" {
    for_each = each.key == local.primary_region ? [1] : []
    
    content {
      role = aws_iam_role.replication.arn
      
      rules = [
        {
          id       = "replicate_to_secondary"
          status   = "Enabled"
          priority = 10
          
          destination = {
            bucket        = module.s3_bucket[local.secondary_region].s3_bucket_arn
            storage_class = "STANDARD"
          }
        },
        {
          id       = "replicate_to_dr"
          status   = "Enabled"
          priority = 20
          
          destination = {
            bucket        = module.s3_bucket[local.dr_region].s3_bucket_arn
            storage_class = "STANDARD_IA"
          }
        }
      ]
    }
  }
  
  tags = merge(local.resource_tags, {
    Region = each.key
  })
}

# CloudWatch Monitoring and Alerting
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  for_each = toset(var.aws_regions)
  
  alarm_name          = "${local.resource_prefix}-high-cpu-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ECS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors ECS cluster CPU utilization"
  alarm_actions      = [aws_sns_topic.alerts[each.key].arn]
  
  dimensions = {
    ClusterName = module.ecs_cluster[each.key].cluster_name
  }
  
  tags = merge(local.resource_tags, {
    Region = each.key
  })
}

# Outputs for other modules
output "vpc_ids" {
  value = {
    for region in var.aws_regions :
    region => module.vpc[region].vpc_id
  }
}

output "ecs_cluster_arns" {
  value = {
    for region in var.aws_regions :
    region => module.ecs_cluster[region].cluster_arn
  }
}

output "rds_endpoints" {
  value = {
    for region in var.aws_regions :
    region => module.rds[region].db_instance_endpoint
  }
}

output "s3_bucket_names" {
  value = {
    for region in var.aws_regions :
    region => module.s3_bucket[region].s3_bucket_id
  }
}