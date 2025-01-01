# Instance class configuration for DocumentDB
variable "db_instance_class" {
  type        = string
  description = "The instance class for DocumentDB cluster nodes (e.g., db.r6g.large for M40 equivalent performance)"
  default     = "db.r6g.large"

  validation {
    condition     = can(regex("^db\\.[trxmz][3-6][a-z]?\\.(small|medium|large|xlarge|[248]xlarge)$", var.db_instance_class))
    error_message = "Instance class must be a valid DocumentDB instance type."
  }
}

# Engine version configuration
variable "db_engine_version" {
  type        = string
  description = "DocumentDB engine version"
  default     = "4.0.0"

  validation {
    condition     = can(regex("^[0-9]\\.[0-9]\\.[0-9]$", var.db_engine_version))
    error_message = "Engine version must be in format X.Y.Z"
  }
}

# Backup retention configuration
variable "db_backup_retention" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7

  validation {
    condition     = var.db_backup_retention >= 1 && var.db_backup_retention <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# Master username configuration
variable "db_master_username" {
  type        = string
  description = "Master username for DocumentDB cluster"
  sensitive   = true

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{2,63}$", var.db_master_username))
    error_message = "Master username must start with a letter, contain only alphanumeric characters or underscore, and be 3-63 characters long."
  }
}

# Master password configuration
variable "db_master_password" {
  type        = string
  description = "Master password for DocumentDB cluster"
  sensitive   = true

  validation {
    condition     = can(regex("^[a-zA-Z0-9_~!@#$%^&*()-=<>,.?;:|]{8,100}$", var.db_master_password)) && can(regex("[A-Z]", var.db_master_password)) && can(regex("[a-z]", var.db_master_password)) && can(regex("[0-9]", var.db_master_password)) && can(regex("[^a-zA-Z0-9]", var.db_master_password))
    error_message = "Password must be 8-100 characters and include uppercase, lowercase, numbers, and special characters."
  }
}

# Instance count configuration
variable "db_instance_count" {
  type        = number
  description = "Number of instances in the DocumentDB cluster"
  default     = 3

  validation {
    condition     = var.db_instance_count >= 2 && var.db_instance_count <= 16
    error_message = "Instance count must be between 2 and 16 for high availability."
  }
}

# Encryption configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable AES-256 encryption at rest"
  default     = true

  validation {
    condition     = var.enable_encryption == true
    error_message = "Encryption must be enabled for compliance requirements."
  }
}

# KMS key configuration
variable "kms_key_id" {
  type        = string
  description = "KMS key ID for encryption"
  default     = ""

  validation {
    condition     = var.kms_key_id == "" || can(regex("^arn:aws:kms:[a-z0-9-]+:[0-9]{12}:key/[a-f0-9-]{36}$", var.kms_key_id))
    error_message = "KMS key ID must be a valid ARN format."
  }
}

# Cluster parameters configuration
variable "cluster_parameters" {
  type        = map(string)
  description = "Custom cluster parameters for DocumentDB"
  default = {
    "tls"                        = "enabled"
    "audit_logs"                 = "enabled"
    "profiler"                   = "enabled"
    "ttl_monitor"               = "enabled"
    "operationProfiling.mode"   = "slowOp"
  }
}

# Maintenance window configuration
variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window"
  default     = "sun:05:00-sun:09:00"

  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-9]{2}:[0-9]{2}-(mon|tue|wed|thu|fri|sat|sun):[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in the format day:HH:MM-day:HH:MM."
  }
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Tags to apply to all DocumentDB resources"
  default = {
    "Service"             = "DocumentDB"
    "SecurityCompliance"  = "HIPAA"
    "DataClassification" = "Sensitive"
  }
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "VPC ID where DocumentDB cluster will be deployed"
}

# Subnet configuration
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for DocumentDB cluster"

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets must be provided for high availability."
  }
}