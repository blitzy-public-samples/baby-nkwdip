# Terraform variable definitions for S3 module
# Configures secure audio file storage with encryption, versioning, and compliance requirements
# Version: ~> 1.0

variable "environment" {
  description = "The deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "bucket_name" {
  description = "Name of the S3 bucket for storing audio files"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9.-]{3,63}$", var.bucket_name))
    error_message = "Bucket name must be between 3 and 63 characters, and can only contain lowercase letters, numbers, hyphens, and periods"
  }
}

variable "versioning_enabled" {
  description = "Enable versioning for the S3 bucket"
  type        = bool
  default     = true
}

variable "retention_days" {
  description = "Number of days to retain audio files before deletion"
  type        = number
  default     = 90
  validation {
    condition     = var.retention_days >= 1 && var.retention_days <= 365
    error_message = "Retention days must be between 1 and 365"
  }
}

variable "encryption_enabled" {
  description = "Enable AES-256 server-side encryption for the S3 bucket"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to be applied to the S3 bucket"
  type        = map(string)
  default     = {}
}