# Cluster outputs
output "cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "The ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_capacity_providers" {
  description = "List of capacity providers configured for the cluster"
  value       = aws_ecs_cluster.main.capacity_providers
}

# Service outputs
output "service_names" {
  description = "Map of service names for each microservice"
  value = {
    for k, v in aws_ecs_service.services : k => v.name
  }
}

output "service_arns" {
  description = "Map of service ARNs for each microservice"
  value = {
    for k, v in aws_ecs_service.services : k => v.id
  }
  sensitive = true
}

output "service_task_definitions" {
  description = "Map of current task definitions for each service"
  value = {
    for k, v in aws_ecs_service.services : k => v.task_definition
  }
}

# Auto-scaling outputs
output "service_scaling_targets" {
  description = "Map of auto-scaling target configurations for each service"
  value = {
    for k, v in aws_appautoscaling_target.services : k => {
      id            = v.id
      min_capacity  = v.min_capacity
      max_capacity  = v.max_capacity
      service_name  = v.resource_id
    }
  }
}

output "service_scaling_policies" {
  description = "Map of auto-scaling policies for each service"
  value = {
    for k, v in aws_appautoscaling_policy.services_cpu : k => {
      name           = v.name
      policy_type    = v.policy_type
      resource_id    = v.resource_id
    }
  }
}

# Monitoring outputs
output "service_health_checks" {
  description = "Map of health check configurations for each service"
  value = {
    for k, v in aws_ecs_service.services : k => {
      grace_period_seconds = v.health_check_grace_period_seconds
      deployment_circuit_breaker = {
        enable   = v.deployment_circuit_breaker[0].enable
        rollback = v.deployment_circuit_breaker[0].rollback
      }
    }
  }
}

output "cloudwatch_log_groups" {
  description = "Map of CloudWatch Log Group ARNs for each service"
  value = {
    for k, v in aws_cloudwatch_log_group.ecs_services : k => v.arn
  }
  sensitive = true
}

output "container_insights_endpoint" {
  description = "CloudWatch Container Insights endpoint for the cluster"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#container-insights:infrastructure/ECS:Cluster/${aws_ecs_cluster.main.name}"
}

# Security outputs
output "task_execution_role_arn" {
  description = "ARN of the ECS task execution IAM role"
  value       = aws_iam_role.ecs_task_execution.arn
  sensitive   = true
}

output "task_security_group_id" {
  description = "ID of the security group attached to ECS tasks"
  value       = aws_security_group.ecs_tasks.id
  sensitive   = true
}