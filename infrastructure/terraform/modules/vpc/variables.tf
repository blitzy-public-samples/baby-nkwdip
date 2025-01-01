# VPC CIDR block configuration
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC. Must be a valid IPv4 CIDR block."
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block (e.g., 10.0.0.0/16)."
  }

  validation {
    condition     = tonumber(split("/", var.vpc_cidr)[1]) <= 24 && tonumber(split("/", var.vpc_cidr)[1]) >= 16
    error_message = "VPC CIDR block must have a prefix length between /16 and /24."
  }
}

# Environment specification
variable "environment" {
  type        = string
  description = "The deployment environment (e.g., dev, staging, prod)."
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Availability zones configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones to deploy resources across."
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }

  validation {
    condition     = alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", az))])
    error_message = "Availability zones must be in the format: region-az (e.g., us-east-1a)."
  }
}

# Public subnet configuration
variable "public_subnet_count" {
  type        = number
  description = "Number of public subnets to create across availability zones."
  
  validation {
    condition     = var.public_subnet_count >= 2 && var.public_subnet_count <= 4
    error_message = "Number of public subnets must be between 2 and 4."
  }
}

# Private subnet configuration
variable "private_subnet_count" {
  type        = number
  description = "Number of private subnets to create across availability zones."
  
  validation {
    condition     = var.private_subnet_count >= 2 && var.private_subnet_count <= 4
    error_message = "Number of private subnets must be between 2 and 4."
  }
}

# NAT Gateway configuration
variable "enable_nat_gateway" {
  type        = bool
  description = "Enable NAT Gateway for private subnet internet access."
  default     = true
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Tags to apply to all resources created by this module."
  
  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "SecurityCompliance")
    error_message = "Tags must include 'Environment' and 'SecurityCompliance' keys for compliance requirements."
  }

  validation {
    condition     = contains(keys(var.tags), "DataClassification")
    error_message = "Tags must include 'DataClassification' key for security requirements."
  }
}

# VPN Gateway configuration
variable "enable_vpn_gateway" {
  type        = bool
  description = "Enable VPN Gateway for secure remote access to VPC resources."
  default     = false
}

# DNS hostname configuration
variable "enable_dns_hostnames" {
  type        = bool
  description = "Enable DNS hostnames in the VPC."
  default     = true
}

# DNS support configuration
variable "enable_dns_support" {
  type        = bool
  description = "Enable DNS support in the VPC."
  default     = true
}