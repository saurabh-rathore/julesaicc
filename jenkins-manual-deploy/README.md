# Jenkins Pipeline for Manual Infrastructure Deployment

This document explains how to use the Jenkins pipeline located in this directory (`jenkins-manual-deploy/Jenkinsfile`). This pipeline is designed to deploy the AI Call Center application to AWS infrastructure that you have already created manually.

## Overview

This pipeline automates the following steps:
1.  Checks out the source code from your repository.
2.  Installs dependencies and runs tests for the backend application.
3.  Installs dependencies and builds the frontend application for production.
4.  Deploys the frontend assets and backend application to your existing AWS resources.

This pipeline **does not** create or manage any infrastructure. It only handles the application deployment.

## Prerequisites

This pipeline requires two sets of prerequisites: the AWS infrastructure must be created, and the servers must be configured with the necessary base software.

### 1. AWS Infrastructure Setup

You must manually create the following resources in your AWS account.

*   **Networking:**
    *   A VPC (Virtual Private Cloud).
    *   A public subnet within the VPC.
    *   An Internet Gateway attached to the VPC and a Route Table to allow public traffic.
*   **EC2 Instances & Security Groups:**
    *   **Application Server:** An EC2 instance (e.g., `t3.large`) running Ubuntu 22.04.
        *   **Security Group:** Must allow inbound traffic on ports: `22` (SSH), `80`/`443` (Web), `5060/udp` (SIP), `10000-20000/udp` (RTP).
    *   **AI/ML Server:** A GPU-enabled EC2 instance (e.g., `g4dn.xlarge`) running Ubuntu 22.04.
        *   **Security Group:** Must allow inbound traffic on ports: `22` (SSH), and must allow traffic on ports `5002` (Coqui TTS) and `11434` (Ollama) from the Application Server's security group.
*   **RDS Database:**
    *   An RDS instance running MySQL 8.0 (e.g., `db.t3.medium`).
    *   **Security Group:** Must allow inbound traffic on port `3306` only from the Application Server's security group.
*   **S3 Bucket:**
    *   A standard S3 bucket to host the static files for the frontend.

### 2. Server Software Setup

Before running the Jenkins pipeline, you must SSH into your newly created EC2 instances and install the necessary base software.

**On the Application Server:**
1.  **Update Packages:** `sudo apt update && sudo apt upgrade -y`
2.  **Install Node.js & PM2:**
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    sudo npm install -g pm2
    ```
3.  **Install Asterisk:**
    ```bash
    sudo apt install -y asterisk
    sudo systemctl enable asterisk && sudo systemctl start asterisk
    ```

**On the AI/ML Server:**
1.  **Update Packages:** `sudo apt update && sudo apt upgrade -y`
2.  **Install Docker & Python:** `sudo apt install -y docker.io python3 python3-pip ffmpeg`
3.  **Install Whisper:** `pip3 install -U openai-whisper`
4.  **Install and Run Coqui TTS:**
    ```bash
    sudo docker run -d -p 5002:5002 --name coqui-tts ghcr.io/coqui-ai/tts-cpu tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC
    ```
5.  **Install and Run Ollama:**
    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ollama pull llama2
    ```

### 3. Jenkins and IAM Setup
*   **Jenkins Agent:** The Jenkins agent running this pipeline must have the AWS CLI installed.
*   **IAM Role/User:** The Jenkins agent needs AWS credentials with permissions to write objects to the S3 bucket (`s3:PutObject`, `s3:DeleteObject`, `s3:Sync`).

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
