# Jenkins Pipeline for AI Server Setup

This document explains how to use the Jenkins pipeline located in this directory (`jenkins-ai-setup/Jenkinsfile`). This pipeline automates the complete software and model setup for the AI/ML server.

## Overview

This pipeline is designed to be run on a freshly provisioned Ubuntu 22.04 server (such as an EC2 instance). It performs two main actions:
1.  It copies the `scripts/setup_ai_models.sh` script to the target server.
2.  It executes the script on the server, which installs all necessary software (Docker, Python, Whisper, Ollama) and downloads the required AI models.

## Prerequisites

1.  **AI/ML Server:** You must have an EC2 instance (or any other server) running Ubuntu 22.04. The server must be accessible from the Jenkins agent via SSH. A GPU-enabled instance is highly recommended for performance.
2.  **Jenkins SSH Credentials:** The pipeline requires passwordless SSH access to the AI/ML server. You must configure this in Jenkins:
    -   Go to "Manage Jenkins" -> "Credentials".
    -   Add a new credential of type **"SSH Username with private key"**.
    -   Enter the SSH username (e.g., `ubuntu`).
    -   Provide the private key that corresponds to the public key installed on the AI/ML server.
    -   Give it a descriptive **ID** (e.g., `ai-server-ssh-key`). You will use this ID when running the pipeline.

## Pipeline Configuration

When you create the pipeline job in Jenkins, you will need to configure it as follows:

1.  Create a new **"Pipeline"** job.
2.  In the "General" tab, check the box for **"This project is parameterized"**.
3.  Add the following **`String` parameters**:
    -   `AI_SERVER_IP`: The public IP address of the target AI/ML server.
    -   `SSH_USER`: The SSH username for the server (the default is `ubuntu`).
    -   `SSH_CREDENTIAL_ID`: The ID of the SSH credential you created in Jenkins (the default is `ai-server-ssh-key`).
4.  In the "Pipeline" section, select **"Pipeline script from SCM"**.
5.  Choose **"Git"** as the SCM and provide your repository URL.
6.  Set the **"Script Path"** to `jenkins-ai-setup/Jenkinsfile`.

## Running the Pipeline

Once configured, you can click **"Build with Parameters"** to run the pipeline. You will be prompted to enter the server's IP address and confirm the credential details. The pipeline will then connect to the server and fully automate its setup. After the pipeline succeeds, your AI/ML server will be ready to serve requests from the application.
