# This file defines the input variables for the Terraform configuration.
# These can be customized by the user when running Terraform.

variable "aws_region" {
  description = "The AWS region to deploy the resources in."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "A name for the project, used for tagging AWS resources."
  type        = string
  default     = "AICallCenter"
}

variable "app_server_instance_type" {
  description = "The EC2 instance type for the application server (Node.js + Asterisk)."
  type        = string
  default     = "t3.large"
}

variable "ai_server_instance_type" {
  description = "The EC2 instance type for the AI/ML server (Whisper, TTS, LLM)."
  type        = string
  default     = "g4dn.xlarge"
}

variable "db_instance_class" {
  description = "The instance class for the RDS MySQL database."
  type        = string
  default     = "db.t3.medium"
}

variable "db_password" {
  description = "The password for the RDS database master user."
  type        = string
  sensitive   = true # Marks this variable as sensitive, so it won't be shown in logs.
}
