# This file defines the S3 bucket for hosting the frontend static website assets.
# In a production setup, this bucket would be the origin for a CloudFront distribution.

resource "aws_s3_bucket" "frontend" {
  # Bucket names must be globally unique.
  bucket = "${lower(var.project_name)}-frontend-assets-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "${var.project_name}-FrontendBucket"
  }
}

# Used to ensure the S3 bucket name is unique.
resource "random_id" "bucket_suffix" {
  byte_length = 8
}

# The following resources would be used to configure the bucket for public website hosting.
# For a production setup, it's better to keep the bucket private and serve content
# via a CloudFront distribution using an Origin Access Identity (OAI).

# resource "aws_s3_bucket_website_configuration" "frontend" {
#   bucket = aws_s3_bucket.frontend.id
#
#   index_document {
#     suffix = "index.html"
#   }
#
#   error_document {
#     key = "index.html"
#   }
# }

# resource "aws_s3_bucket_policy" "frontend" {
#   bucket = aws_s3_bucket.frontend.id
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect    = "Allow"
#         Principal = "*"
#         Action    = "s3:GetObject"
#         Resource  = "${aws_s3_bucket.frontend.arn}/*"
#       },
#     ]
#   })
# }
