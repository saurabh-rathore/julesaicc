# This file defines the AWS Relational Database Service (RDS) instance for our MySQL database.

# RDS instances require a DB Subnet Group, which tells RDS which subnets it can be placed in.
# For a production environment, you would create dedicated private subnets for the database.
# For simplicity in this example, we are using the public subnet created in main.tf.
resource "aws_db_subnet_group" "default" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.public.id]

  tags = {
    Name = "${var.project_name}-DBSubnetGroup"
  }
}

# Create the RDS MySQL instance
resource "aws_db_instance" "default" {
  identifier           = "${lower(var.project_name)}-db"
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "mysql"
  engine_version       = "8.0"
  instance_class       = var.db_instance_class
  db_name              = "ai_call_center" # Initial database name
  username             = "admin"
  password             = var.db_password
  db_subnet_group_name = aws_db_subnet_group.default.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible  = false # Best practice: database should not be publicly accessible

  # For production, you should set this to false and define a final snapshot identifier.
  skip_final_snapshot  = true
}
