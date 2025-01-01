# Cluster identifier output
output "cluster_id" {
  description = "The identifier of the DocumentDB cluster for reference and monitoring"
  value       = aws_docdb_cluster.main.id
}

# Primary cluster endpoint for write operations
output "cluster_endpoint" {
  description = "The primary endpoint of the DocumentDB cluster for write operations and cluster management"
  value       = aws_docdb_cluster.main.endpoint
}

# Reader endpoint for load-balanced read operations
output "reader_endpoint" {
  description = "The reader endpoint of the DocumentDB cluster for load-balanced read operations"
  value       = aws_docdb_cluster.main.reader_endpoint
}

# Cluster port number
output "cluster_port" {
  description = "The port number on which the DocumentDB cluster accepts connections"
  value       = aws_docdb_cluster.main.port
}

# List of instance endpoints with availability zones
output "instance_endpoints" {
  description = "List of instance endpoints with their corresponding availability zones for targeted read operations"
  value = [
    for instance in aws_docdb_cluster_instance.main : {
      endpoint           = instance.endpoint
      availability_zone = instance.availability_zone
    }
  ]
}

# Formatted connection string with security parameters
output "connection_string" {
  description = "MongoDB-compatible connection string with security, timeout, and reliability parameters"
  value       = format(
    "mongodb://%s:%d,%s/?tls=true&tlsCAFile=rds-combined-ca-bundle.pem&retryWrites=true&w=majority&readPreference=secondary&maxPoolSize=150&minPoolSize=10&maxIdleTimeMS=300000&connectTimeoutMS=10000&serverSelectionTimeoutMS=15000&socketTimeoutMS=5000&compressors=snappy,zlib&replicaSet=rs0&ssl=true&authSource=admin",
    aws_docdb_cluster.main.endpoint,
    aws_docdb_cluster.main.port,
    aws_docdb_cluster.main.reader_endpoint
  )
  sensitive = true
}

# Instance class information
output "instance_class" {
  description = "The compute and memory capacity of the DocumentDB instances"
  value       = var.db_instance_class
}

# Number of instances in the cluster
output "instance_count" {
  description = "The number of instances in the DocumentDB cluster"
  value       = var.db_instance_count
}

# Engine version information
output "engine_version" {
  description = "The version number of the DocumentDB engine"
  value       = var.engine_version
}

# Cluster resource ID
output "cluster_resource_id" {
  description = "The resource ID of the DocumentDB cluster for CloudWatch monitoring"
  value       = aws_docdb_cluster.main.cluster_resource_id
}

# Cluster ARN
output "cluster_arn" {
  description = "The ARN of the DocumentDB cluster for IAM and resource policies"
  value       = aws_docdb_cluster.main.arn
}

# Security group ID
output "security_group_id" {
  description = "The ID of the security group associated with the DocumentDB cluster"
  value       = aws_security_group.docdb.id
}

# Parameter group name
output "parameter_group_name" {
  description = "The name of the cluster parameter group used by the DocumentDB cluster"
  value       = aws_docdb_cluster_parameter_group.main.name
}

# Subnet group name
output "subnet_group_name" {
  description = "The name of the subnet group where the DocumentDB cluster is placed"
  value       = aws_docdb_subnet_group.main.name
}

# KMS key ID
output "kms_key_id" {
  description = "The ID of the KMS key used for encrypting the DocumentDB cluster"
  value       = aws_kms_key.docdb.id
  sensitive   = true
}