# Provider configuration with enhanced security features
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
  required_version = "~> 1.0"
}

# Data sources for current AWS region and account
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Local variables for resource naming and tagging
locals {
  name_prefix = "bca-${var.environment}"
  common_tags = {
    Project             = "BabyCryAnalyzer"
    Environment        = var.environment
    ManagedBy          = "Terraform"
    SecurityCompliance = "HIPAA-GDPR-SOC2"
    DataClassification = "Sensitive"
  }
  
  # Service configuration map
  services = {
    api = {
      name          = "api"
      min_capacity  = 3
      max_capacity  = 6
      cpu_threshold = 70
    }
    auth = {
      name          = "auth"
      min_capacity  = 2
      max_capacity  = 4
      cpu_threshold = 70
    }
    ml = {
      name          = "ml"
      min_capacity  = 2
      max_capacity  = 4
      cpu_threshold = 80
    }
    analysis = {
      name          = "analysis"
      min_capacity  = 3
      max_capacity  = 6
      cpu_threshold = 75
    }
  }
}

# ECS Cluster with Container Insights
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name    = "/aws/ecs/${local.name_prefix}-cluster"
      }
    }
  }

  tags = local.common_tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# CloudWatch Log Groups for ECS Services
resource "aws_cloudwatch_log_group" "ecs_services" {
  for_each = local.services

  name              = "/aws/ecs/${local.name_prefix}-${each.key}"
  retention_in_days = 90
  
  tags = merge(local.common_tags, {
    Service = each.key
  })
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# ECS Task Execution Role Policy
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name_prefix}-ecs-tasks"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow inbound traffic from within VPC"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = [data.aws_vpc.selected.cidr_block]
  }

  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-tasks"
  })
}

# ECS Task Definitions for each service
resource "aws_ecs_task_definition" "services" {
  for_each = local.services

  family                   = "${local.name_prefix}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn           = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = each.key
      image        = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/${each.key}:latest"
      essential    = true
      environment  = []
      secrets      = []
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_services[each.key].name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
    }
  ])

  tags = merge(local.common_tags, {
    Service = each.key
  })
}

# ECS Services
resource "aws_ecs_service" "services" {
  for_each = local.services

  name                               = "${local.name_prefix}-${each.key}"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.services[each.key].arn
  desired_count                     = each.value.min_capacity
  launch_type                       = "FARGATE"
  platform_version                  = "LATEST"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = merge(local.common_tags, {
    Service = each.key
  })
}

# Auto Scaling Targets
resource "aws_appautoscaling_target" "services" {
  for_each = local.services

  max_capacity       = each.value.max_capacity
  min_capacity       = each.value.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policies
resource "aws_appautoscaling_policy" "services_cpu" {
  for_each = local.services

  name               = "${local.name_prefix}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = each.value.cpu_threshold
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Data source for VPC
data "aws_vpc" "selected" {
  id = var.vpc_id
}