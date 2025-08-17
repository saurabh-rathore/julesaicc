# This block configures the AWS provider for Terraform.
# It specifies that we are using the 'aws' provider and allows setting a default region.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # Use a recent version of the AWS provider
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region
}
