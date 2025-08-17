# Jenkins Pipeline for Manual Infrastructure Deployment

This document explains how to use the Jenkins pipeline located in this directory (`jenkins-manual-deploy/Jenkinsfile`). This pipeline is designed to deploy the AI Call Center application to AWS infrastructure that you have already created manually.

## Overview

This pipeline automates the following steps:
1.  Checks out the source code from your repository.
2.  Installs dependencies and runs tests for the backend application.
3.  Installs dependencies and builds the frontend application for production.
4.  Deploys the frontend assets and backend application to your existing AWS resources.

This pipeline **does not** create or manage any infrastructure. It only handles the application deployment.

## Prerequisite: Manually Created AWS Infrastructure

Before you can run this pipeline, you must manually create and configure the following resources in your AWS account. It is crucial that the security groups are set up correctly to allow the different components to communicate with each other.

**1. Networking:**
   - A VPC (Virtual Private Cloud).
   - A public subnet within the VPC.
   - An Internet Gateway attached to the VPC and a Route Table to allow public traffic.

**2. EC2 Instances:**
   - **Application Server:** An EC2 instance (e.g., `t3.large`) running Ubuntu 22.04. This will host the Node.js backend and Asterisk.
     - **Security Group:** Must allow inbound traffic on these ports:
       - `22` (SSH) from your IP address for access.
       - `80` (HTTP) and `443` (HTTPS) from anywhere (`0.0.0.0/0`).
       - `5060/udp` (SIP) from anywhere.
       - `10000-20000/udp` (RTP media streams) from anywhere.
   - **AI/ML Server:** A GPU-enabled EC2 instance (e.g., `g4dn.xlarge`) running Ubuntu 22.04. This will host Whisper, Coqui TTS, and Ollama.
     - **Security Group:** Must allow inbound traffic on these ports:
       - `22` (SSH) from your IP address.
       - `5002` (Coqui TTS) from the **security group** of the Application Server.
       - `11434` (Ollama) from the **security group** of the Application Server.

**3. RDS Database:**
   - An RDS instance running MySQL 8.0 (e.g., `db.t3.medium`).
   - **Security Group:** Must allow inbound traffic on port `3306` only from the **security group** of the Application Server.

**4. S3 Bucket:**
   - A standard S3 bucket to host the static files for the frontend. The bucket can be private if you plan to use CloudFront, or public if accessed directly (not recommended).

**5. Jenkins and IAM Setup:**
   - **Jenkins Agent:** The Jenkins agent that will run this pipeline must have the AWS CLI installed.
   - **IAM Role/User:** The Jenkins agent needs AWS credentials with permissions to write objects to the S3 bucket (`s3:PutObject`, `s3:DeleteObject`, `s3:Sync`).

## Jenkins Pipeline Configuration

When you create the pipeline job in Jenkins, you must configure it as follows:

1.  Create a new **"Pipeline"** job.
2.  In the "General" tab, check the box for **"This project is parameterized"**.
3.  Add the following **`String` parameters**:
    -   `APP_SERVER_IP`: The public IP address of your Application Server.
    -   `AI_SERVER_IP`: The public IP address of your AI/ML Server.
    -   `S3_BUCKET_NAME`: The name of the S3 bucket you created for the frontend.
4.  In the "Pipeline" section, select **"Pipeline script from SCM"**.
5.  Choose **"Git"** as the SCM and provide your repository URL.
6.  Set the **"Script Path"** to `jenkins-manual-deploy/Jenkinsfile`.

## Running the Pipeline

Once configured, you can click **"Build with Parameters"** to run the pipeline. You will be prompted to enter the IP addresses and S3 bucket name. The pipeline will then build, test, and deploy the application to your infrastructure. The `Deploy Application` stage will pause for your manual approval as a final safety check.
