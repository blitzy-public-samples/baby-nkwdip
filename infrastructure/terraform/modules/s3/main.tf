# S3 Module for Baby Cry Analyzer
# Implements secure audio file storage with encryption, versioning, and compliance controls
# Version: ~> 1.0
# Provider version: hashicorp/aws ~> 4.0

# Primary S3 bucket resource with enhanced security configurations
resource "aws_s3_bucket" "main" {
  bucket        = var.bucket_name
  force_destroy = false

  # Comprehensive tagging for compliance and management
  tags = merge(
    var.tags,
    {
      Environment      = var.environment
      ComplianceLevel = "high"
      DataType        = "audio"
      RetentionPolicy = "90days"
      SecurityLevel   = "confidential"
      Encryption      = "AES256"
      HIPAA          = "compliant"
      GDPR           = "compliant"
      SOC2           = "compliant"
    }
  )
}

# Enable versioning for audit compliance and data protection
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

# Configure AES-256 server-side encryption for data at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Implement lifecycle rules for retention management
resource "aws_s3_bucket_lifecycle_rule" "main" {
  bucket = aws_s3_bucket.main.id
  id      = "audio_file_retention"
  enabled = true
  prefix  = "audio/"

  # Configure expiration for current versions
  expiration {
    days = var.retention_days
  }

  # Clean up noncurrent versions quickly
  noncurrent_version_expiration {
    days = 1
  }

  # Abort incomplete multipart uploads
  abort_incomplete_multipart_upload {
    days_after_initiation = 1
  }
}

# Block all public access for security
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable intelligent tiering for cost optimization
resource "aws_s3_bucket_intelligent_tiering_configuration" "main" {
  bucket = aws_s3_bucket.main.id
  name   = "EntireAudioBucket"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}

# Configure bucket policy for strict access control
resource "aws_s3_bucket_policy" "main" {
  bucket = aws_s3_bucket.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.main.arn,
          "${aws_s3_bucket.main.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid       = "EnforceEncryptedTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource = "${aws_s3_bucket.main.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      }
    ]
  })
}

# Enable logging for audit compliance
resource "aws_s3_bucket_logging" "main" {
  bucket = aws_s3_bucket.main.id

  target_bucket = aws_s3_bucket.main.id
  target_prefix = "logs/"
}

# Configure CORS for secure client access
resource "aws_s3_bucket_cors_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://*.babycryanalyzer.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}