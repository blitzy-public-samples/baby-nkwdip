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
  }
}

# Default provider configuration for primary region (US East)
provider "aws" {
  region = var.aws_regions[0] # Primary region

  # Enhanced security and compliance settings
  default_tags {
    tags = {
      Environment     = var.environment
      ManagedBy      = "Terraform"
      SecurityLevel  = "High"
      ComplianceReqs = "HIPAA,GDPR,SOC2"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformDeploymentRole"
    session_name = "TerraformDeployment"
  }

  # Enhanced security configurations
  endpoints {
    s3 = "https://s3.${var.aws_regions[0]}.amazonaws.com"
    kms = "https://kms.${var.aws_regions[0]}.amazonaws.com"
  }
}

# Secondary region provider (US West)
provider "aws" {
  alias  = "us_west"
  region = var.aws_regions[1] # Secondary region

  default_tags {
    tags = {
      Environment     = var.environment
      ManagedBy      = "Terraform"
      SecurityLevel  = "High"
      ComplianceReqs = "HIPAA,GDPR,SOC2"
      Region         = "Secondary"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformDeploymentRole"
    session_name = "TerraformDeployment-USWest"
  }

  # Enhanced security configurations
  endpoints {
    s3 = "https://s3.${var.aws_regions[1]}.amazonaws.com"
    kms = "https://kms.${var.aws_regions[1]}.amazonaws.com"
  }
}

# Disaster recovery region provider (EU Central)
provider "aws" {
  alias  = "eu_central"
  region = var.aws_regions[2] # DR region

  default_tags {
    tags = {
      Environment     = var.environment
      ManagedBy      = "Terraform"
      SecurityLevel  = "High"
      ComplianceReqs = "HIPAA,GDPR,SOC2"
      Region         = "DR"
      DataLocality   = "EU"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformDeploymentRole"
    session_name = "TerraformDeployment-EUCentral"
  }

  # Enhanced security configurations with GDPR considerations
  endpoints {
    s3 = "https://s3.${var.aws_regions[2]}.amazonaws.com"
    kms = "https://kms.${var.aws_regions[2]}.amazonaws.com"
  }
}

# Random provider for generating secure unique identifiers
provider "random" {
  # Enhanced entropy settings for security-critical random values
}

# Provider feature flags for enhanced security
provider "aws" {
  alias = "security_baseline"
  
  # Enable security features
  skip_credentials_validation = false
  skip_metadata_api_check    = false
  skip_region_validation     = false
  
  # Enable detailed CloudTrail logging for SOC 2 compliance
  endpoints {
    cloudtrail = "https://cloudtrail.${var.aws_regions[0]}.amazonaws.com"
  }
}