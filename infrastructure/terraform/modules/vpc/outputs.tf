# VPC ID output for resource association
output "vpc_id" {
  description = "The ID of the VPC for resource association and network isolation"
  value       = aws_vpc.main.id
}

# VPC CIDR block output for network planning
output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for network planning and security group configuration"
  value       = aws_vpc.main.cidr_block
}

# Public subnet IDs for load balancer and public service deployment
output "public_subnet_ids" {
  description = "List of public subnet IDs for deploying public-facing resources like load balancers"
  value       = aws_subnet.public[*].id
}

# Private subnet IDs for application and database deployment
output "private_subnet_ids" {
  description = "List of private subnet IDs for deploying secure application components and databases"
  value       = aws_subnet.private[*].id
}

# NAT Gateway IDs for private subnet internet access
output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs used for private subnet internet access"
  value       = aws_nat_gateway.main[*].id
  sensitive   = true
}

# Availability zones used for resource distribution
output "availability_zones" {
  description = "List of availability zones where network resources are deployed"
  value       = var.availability_zones
  sensitive   = true

  # Validate AZ format for security and compliance
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d[a-z]$", each.value))
    error_message = "Availability zone format must be valid AWS AZ format (e.g., us-east-1a)"
  }
}

# Route table IDs for network configuration
output "private_route_table_ids" {
  description = "List of private route table IDs for network configuration and security"
  value       = aws_route_table.private[*].id
  sensitive   = true
}

# Network ACL ID for security configuration
output "network_acl_id" {
  description = "The ID of the main network ACL for security rule management"
  value       = aws_network_acl.main.id
  sensitive   = true
}

# VPC Flow Log configuration for compliance
output "vpc_flow_log_id" {
  description = "The ID of the VPC Flow Log for network traffic auditing"
  value       = aws_flow_log.main.id
  sensitive   = true
}

# VPN Gateway ID if enabled
output "vpn_gateway_id" {
  description = "The ID of the VPN Gateway if enabled for secure remote access"
  value       = var.enable_vpn_gateway ? aws_vpn_gateway.main[0].id : null
  sensitive   = true
}

# Security group default ID
output "default_security_group_id" {
  description = "The ID of the default VPC security group for base network security"
  value       = aws_vpc.main.default_security_group_id
  sensitive   = true
}

# VPC Endpoint information for service access
output "vpc_endpoint_info" {
  description = "Map of VPC Endpoint information for secure AWS service access"
  value = {
    vpc_id     = aws_vpc.main.id
    subnet_ids = aws_subnet.private[*].id
    vpc_cidr   = aws_vpc.main.cidr_block
  }
  sensitive = true
}