# Cluster name configuration
variable "cluster_name" {
  type        = string
  description = "The name of the ECS cluster for the Baby Cry Analyzer application"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.cluster_name))
    error_message = "Cluster name must contain only alphanumeric characters and hyphens."
  }
}

# Service configurations
variable "services" {
  type = map(object({
    name  = string
    image = string
    port  = number
    health_check = object({
      path     = string
      interval = number
      timeout  = number
      retries  = number
    })
  }))
  description = "Configuration map for ECS services including API, Auth, ML, and Analysis services"

  validation {
    condition     = length(var.services) >= 1
    error_message = "At least one service must be defined."
  }
}

# Task CPU allocation
variable "task_cpu" {
  type = map(object({
    min = number
    max = number
  }))
  description = "CPU allocation ranges for each service in CPU units (1024 = 1 vCPU)"
  default = {
    api = {
      min = 256
      max = 1024
    }
    auth = {
      min = 256
      max = 512
    }
    ml = {
      min = 512
      max = 2048
    }
    analysis = {
      min = 512
      max = 1024
    }
  }
}

# Task memory allocation
variable "task_memory" {
  type = map(object({
    min = number
    max = number
  }))
  description = "Memory allocation ranges for each service in MiB"
  default = {
    api = {
      min = 512
      max = 2048
    }
    auth = {
      min = 512
      max = 1024
    }
    ml = {
      min = 1024
      max = 4096
    }
    analysis = {
      min = 1024
      max = 2048
    }
  }
}

# Auto-scaling configuration
variable "scaling_config" {
  type = map(object({
    min_capacity             = number
    max_capacity            = number
    target_cpu_utilization  = number
    target_memory_utilization = number
    scale_in_cooldown       = number
    scale_out_cooldown      = number
  }))
  description = "Auto-scaling configuration for each service"

  validation {
    condition     = alltrue([for k, v in var.scaling_config : v.min_capacity <= v.max_capacity])
    error_message = "Minimum capacity must be less than or equal to maximum capacity for all services."
  }

  validation {
    condition     = alltrue([for k, v in var.scaling_config : v.target_cpu_utilization > 0 && v.target_cpu_utilization < 100])
    error_message = "Target CPU utilization must be between 0 and 100 percent."
  }
}

# Container insights configuration
variable "container_insights" {
  type        = bool
  description = "Enable CloudWatch Container Insights for detailed monitoring"
  default     = true
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "The ID of the VPC where the ECS cluster will be deployed"
}

# Subnet configuration
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for ECS task deployment"

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be provided for high availability."
  }
}

# Load balancer target group configuration
variable "target_groups" {
  type = map(object({
    port                = number
    protocol            = string
    health_check_path   = string
    health_check_interval = number
    deregistration_delay = number
  }))
  description = "Load balancer target group configuration for each service"
}

# Service discovery configuration
variable "service_discovery_namespace" {
  type        = string
  description = "The namespace for AWS Cloud Map service discovery"
  default     = "babycryanalyzer.local"
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Tags to apply to all ECS resources"
  default = {
    Project     = "BabyCryAnalyzer"
    ManagedBy   = "Terraform"
    Environment = "prod"
  }
}

# Capacity provider strategy
variable "capacity_provider_strategy" {
  type = map(object({
    fargate_weight      = number
    fargate_spot_weight = number
  }))
  description = "Capacity provider weights for FARGATE and FARGATE_SPOT"
  default = {
    api = {
      fargate_weight      = 1
      fargate_spot_weight = 0
    }
    auth = {
      fargate_weight      = 1
      fargate_spot_weight = 0
    }
    ml = {
      fargate_weight      = 1
      fargate_spot_weight = 0
    }
    analysis = {
      fargate_weight      = 1
      fargate_spot_weight = 0
    }
  }
}

# Log retention configuration
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain CloudWatch logs"
  default     = 90

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be one of the allowed values as per AWS CloudWatch requirements."
  }
}