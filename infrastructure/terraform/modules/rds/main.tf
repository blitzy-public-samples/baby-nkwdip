# Provider configuration with required versions
terraform {
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

# Local variables for common resource tagging
locals {
  common_tags = {
    Project             = "BabyCryAnalyzer"
    ManagedBy          = "Terraform"
    SecurityCompliance = "HIPAA-GDPR"
    DataClassification = "Sensitive"
  }
}

# Generate secure random password for database
resource "random_password" "docdb_master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# KMS key for database encryption
resource "aws_kms_key" "docdb" {
  description             = "KMS key for DocumentDB encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(local.common_tags, {
    Name = "bca-docdb-kms-key"
  })
}

# Subnet group for DocumentDB cluster
resource "aws_docdb_subnet_group" "main" {
  name       = "bca-docdb-subnet-group"
  subnet_ids = data.terraform_remote_state.vpc.outputs.private_subnet_ids
  
  tags = merge(local.common_tags, {
    Name = "bca-docdb-subnet-group"
  })
}

# Parameter group for enhanced security
resource "aws_docdb_cluster_parameter_group" "main" {
  family = "docdb4.0"
  name   = "bca-docdb-params"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  parameter {
    name  = "audit_logs"
    value = "enabled"
  }

  parameter {
    name  = "ttl_monitor"
    value = "enabled"
  }

  tags = merge(local.common_tags, {
    Name = "bca-docdb-params"
  })
}

# Security group for DocumentDB cluster
resource "aws_security_group" "docdb" {
  name        = "bca-docdb-sg"
  description = "Security group for DocumentDB cluster"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  tags = merge(local.common_tags, {
    Name = "bca-docdb-sg"
  })
}

# Main DocumentDB cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier              = "bca-docdb-cluster"
  engine                         = "docdb"
  engine_version                 = var.db_engine_version
  master_username                = "bcaadmin"
  master_password                = random_password.docdb_master.result
  backup_retention_period        = var.db_backup_retention
  preferred_backup_window        = "03:00-05:00"
  preferred_maintenance_window   = "mon:05:00-mon:07:00"
  skip_final_snapshot           = false
  final_snapshot_identifier     = "bca-docdb-final-snapshot"
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.docdb.arn
  vpc_security_group_ids        = [aws_security_group.docdb.id]
  db_subnet_group_name          = aws_docdb_subnet_group.main.name
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.main.name
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]
  deletion_protection           = true
  apply_immediately             = false

  tags = merge(local.common_tags, {
    Name = "bca-docdb-cluster"
  })
}

# DocumentDB cluster instances
resource "aws_docdb_cluster_instance" "main" {
  count                        = 3
  identifier                  = "bca-docdb-instance-${count.index + 1}"
  cluster_identifier          = aws_docdb_cluster.main.id
  instance_class              = var.db_instance_class
  preferred_maintenance_window = "mon:05:00-mon:07:00"
  auto_minor_version_upgrade  = true
  enable_performance_insights = true
  performance_insights_kms_key_id = aws_kms_key.docdb.arn

  tags = merge(local.common_tags, {
    Name = "bca-docdb-instance-${count.index + 1}"
  })
}

# CloudWatch alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "docdb_cpu" {
  alarm_name          = "bca-docdb-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/DocDB"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors DocumentDB CPU utilization"
  alarm_actions      = [var.sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = aws_docdb_cluster.main.cluster_identifier
  }
}

# Outputs for other modules
output "docdb_cluster_id" {
  description = "The ID of the DocumentDB cluster"
  value       = aws_docdb_cluster.main.id
}

output "docdb_endpoint" {
  description = "The endpoint of the DocumentDB cluster"
  value       = aws_docdb_cluster.main.endpoint
}

output "docdb_port" {
  description = "The port of the DocumentDB cluster"
  value       = aws_docdb_cluster.main.port
}

output "docdb_master_username" {
  description = "The master username for the DocumentDB cluster"
  value       = aws_docdb_cluster.main.master_username
  sensitive   = true
}