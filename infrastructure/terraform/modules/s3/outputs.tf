# Output definitions for S3 module
# Exposes essential bucket information for secure audio file storage and infrastructure integration
# Version: ~> 1.0

output "bucket_id" {
  description = "The ID of the S3 bucket"
  value       = aws_s3_bucket.main.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.main.arn
}

output "bucket_domain_name" {
  description = "The domain name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket_domain_name
}

output "versioning_status" {
  description = "The versioning status of the S3 bucket"
  value       = aws_s3_bucket_versioning.main.status
}