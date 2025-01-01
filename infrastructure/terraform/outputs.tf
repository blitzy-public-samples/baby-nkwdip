# Output definitions for Baby Cry Analyzer infrastructure deployment
# Exposes critical resource identifiers and endpoints for multi-region infrastructure

# VPC IDs per region for network management
output "vpc_ids" {
  value = {
    for region in var.aws_regions : region => module.vpc_module[region].vpc_id
  }
  description = "Map of VPC IDs per region (Primary: US-East, Secondary: US-West, DR: EU-Central)"
}

# ECS cluster ARNs for container orchestration
output "ecs_cluster_arns" {
  value = {
    for region in var.aws_regions : region => module.ecs_module[region].cluster_arn
  }
  description = "Map of ECS cluster ARNs per region for container deployment and scaling"
}

# RDS endpoints with sensitive flag
output "rds_endpoints" {
  value = {
    for region in var.aws_regions : region => module.rds_module[region].endpoint
  }
  description = "Map of RDS endpoint URLs per region for database connectivity"
  sensitive   = true
}

# S3 bucket names for audio storage
output "s3_bucket_names" {
  value = {
    for region in var.aws_regions : region => module.s3_module[region].bucket_name
  }
  description = "Map of S3 bucket names per region for audio file storage"
}

# Redis endpoints with sensitive flag
output "redis_endpoints" {
  value = {
    for region in var.aws_regions : region => module.redis_module[region].endpoint
  }
  description = "Map of Redis endpoints per region for caching layer access"
  sensitive   = true
}

# CloudFront distribution ID for CDN
output "cloudfront_distribution_id" {
  value       = module.cloudfront_module.distribution_id
  description = "CloudFront distribution ID for global content delivery network"
}

# Route53 hosted zone ID for DNS management
output "route53_zone_id" {
  value       = module.route53_module.hosted_zone_id
  description = "Route53 hosted zone ID for DNS management and regional routing"
}

# KMS key ARNs with sensitive flag
output "kms_key_arns" {
  value = {
    for region in var.aws_regions : region => module.kms_module[region].key_arn
  }
  description = "Map of KMS key ARNs per region for encryption management"
  sensitive   = true
}

# Load balancer DNS names
output "load_balancer_dns" {
  value = {
    for region in var.aws_regions : region => module.ecs_module[region].load_balancer_dns
  }
  description = "Map of load balancer DNS names per region for service access"
}

# Database security group IDs
output "db_security_group_ids" {
  value = {
    for region in var.aws_regions : region => module.rds_module[region].security_group_id
  }
  description = "Map of database security group IDs per region for network security"
}

# Private subnet IDs for each region
output "private_subnet_ids" {
  value = {
    for region in var.aws_regions : region => module.vpc_module[region].private_subnet_ids
  }
  description = "Map of private subnet IDs per region for secure resource placement"
}

# CloudWatch log group names
output "cloudwatch_log_groups" {
  value = {
    for region in var.aws_regions : region => module.ecs_module[region].log_group_name
  }
  description = "Map of CloudWatch log group names per region for centralized logging"
}

# WAF web ACL ID
output "waf_web_acl_id" {
  value       = module.cloudfront_module.web_acl_id
  description = "WAF web ACL ID for security and access control"
}

# Backup vault ARNs
output "backup_vault_arns" {
  value = {
    for region in var.aws_regions : region => module.rds_module[region].backup_vault_arn
  }
  description = "Map of backup vault ARNs per region for disaster recovery"
}