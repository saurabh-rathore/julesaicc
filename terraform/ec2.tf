# This file defines the EC2 instances that will run our application components.

# Data source to find the latest Amazon Machine Image (AMI) for Ubuntu 22.04.
# This avoids hardcoding an AMI ID, which can become outdated.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical's official owner ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# --- EC2 Instances ---

# Create the Application Server EC2 instance to run the Node.js backend and Asterisk.
resource "aws_instance" "app_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.app_server_instance_type
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app_server.id]

  # In a real deployment, you would use a key pair to allow SSH access.
  # key_name = "your-aws-key-pair-name"

  tags = {
    Name = "${var.project_name}-AppServer"
  }
}

# Create the AI/ML Server EC2 instance to run Whisper, Coqui TTS, and the LLM.
resource "aws_instance" "ai_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.ai_server_instance_type
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ai_server.id]

  # key_name = "your-aws-key-pair-name"

  tags = {
    Name = "${var.project_name}-AIServer"
  }
}
