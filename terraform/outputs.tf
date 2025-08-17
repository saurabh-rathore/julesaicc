# This file defines the output values from our Terraform configuration.
# These outputs are printed after a successful 'terraform apply' and can be queried later,
# which is useful for configuring DNS or connecting to the resources.

output "app_server_public_ip" {
  description = "The public IP address of the application server."
  value       = aws_instance.app_server.public_ip
}

output "ai_server_public_ip" {
  description = "The public IP address of the AI/ML server."
  value       = aws_instance.ai_server.public_ip
}

output "rds_database_endpoint" {
  description = "The connection endpoint for the RDS database."
  value       = aws_db_instance.default.endpoint
}

output "rds_database_port" {
  description = "The port for the RDS database."
  value       = aws_db_instance.default.port
}

output "frontend_s3_bucket_name" {
  description = "The name of the S3 bucket for the frontend assets."
  value       = aws_s3_bucket.frontend.bucket
}
