# Backend configuration for Baby Cry Analyzer infrastructure
# Version: ~> 4.0 (AWS Provider)

terraform {
  backend "s3" {
    # Primary state storage bucket in us-east-1
    bucket = "babycryanalyzer-terraform-state"
    
    # Dynamic state file path based on environment
    key = "${var.environment}/terraform.tfstate"
    
    # Primary region for state management
    region = "us-east-1"
    
    # Enhanced security configurations
    encrypt        = true
    acl            = "private"
    kms_key_id     = "alias/terraform-state-key"
    
    # State locking using DynamoDB
    dynamodb_table = "terraform-state-lock"
    
    # Versioning for state history and recovery
    versioning = true
    
    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "aws:kms"
        }
      }
    }
    
    # Additional security measures
    force_destroy = false
    
    # Access logging for audit compliance
    logging {
      target_bucket = "babycryanalyzer-terraform-state-logs"
      target_prefix = "state-access-logs/"
    }
    
    # Cross-region replication for DR
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication"
      
      rules {
        id     = "state-replication-rule"
        status = "Enabled"
        
        destination {
          bucket = "arn:aws:s3:::babycryanalyzer-terraform-state-dr"
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:us-west-2:ACCOUNT_ID:key/replica-key-id"
          }
        }
      }
    }
    
    # Lifecycle rules for state management
    lifecycle_rule {
      enabled = true
      
      noncurrent_version_expiration {
        days = 90
      }
      
      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }
    }
    
    # Tags for resource management
    tags = {
      Environment     = var.environment
      Application     = "BabyCryAnalyzer"
      ManagedBy      = "Terraform"
      DataClass      = "Infrastructure-Critical"
      ComplianceReq  = "HIPAA,GDPR,SOC2"
    }
  }
}

# Data source for KMS key validation
data "aws_kms_key" "terraform_state_key" {
  key_id = "alias/terraform-state-key"
}

# Data source for DynamoDB table validation
data "aws_dynamodb_table" "state_lock" {
  name = "terraform-state-lock"
}

# Output backend configuration for reference
output "backend_config" {
  value = {
    bucket         = "babycryanalyzer-terraform-state"
    dynamodb_table = "terraform-state-lock"
    kms_key_id     = data.aws_kms_key.terraform_state_key.arn
    region         = "us-east-1"
  }
  
  description = "Backend configuration details for state management"
  
  sensitive = true
}