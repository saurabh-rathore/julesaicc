# AI Call Center - Deployment Guide

## Introduction

This guide provides step-by-step instructions for deploying the AI Call Center application. It is intended for users who may be new to deploying multi-component web applications.

This is a complex application with several interconnected services. Please read the instructions for each step carefully.

## Server Requirements

For a production environment, it is highly recommended to separate services onto different servers for performance and scalability. However, for a small-scale deployment or for testing purposes, you can install all components on a single, powerful server.

### Option 1: Single-Server Deployment (for testing or small scale)

This is the simplest way to get started.

-   **Operating System:** Ubuntu 22.04 LTS
-   **CPU:** 8+ cores
-   **RAM:** 32GB+ (The AI models can be very memory-intensive)
-   **GPU:** An NVIDIA GPU with 16GB+ of VRAM is **highly recommended**. Running the AI models on a CPU will be very slow.
-   **Storage:** 100GB+ of fast SSD storage.
-   **Domain Name:** You will need a registered domain name (e.g., `your-ai-center.com`) pointed to your server's public IP address. This is required to enable secure HTTPS.

### Option 2: Multi-Server Production Deployment (Recommended)

-   **Application Server (AWS EC2):** An instance like `t3.large` running Ubuntu 22.04. This will run the Node.js backend and Asterisk.
-   **AI/ML Server (AWS EC2):** A GPU-enabled instance like `g4dn.xlarge` running Ubuntu 22.04. This will run the Whisper, Coqui TTS, and LLM services.
-   **Database Server (AWS RDS):** An AWS RDS instance running MySQL, such as `db.t3.medium`.
-   **Web Frontend (AWS S3/CloudFront):** The Angular frontend can be hosted as a static website on an S3 bucket and served via a CloudFront distribution for global performance and caching.

This guide will focus on the **single-server deployment** for simplicity. The provided Terraform scripts can be used as a starting point for the multi-server setup.

---

## Manual Deployment Steps (Single-Server)

These steps will guide you through setting up all the necessary components on a single Ubuntu 22.04 server.

### Part 1: Initial Server Setup

1.  **Log in to your server** via SSH.
2.  **Update system packages** to ensure all software is up-to-date.
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```
3.  **Configure the Firewall** to allow web and telephone traffic.
    ```bash
    sudo ufw allow ssh          # Allows you to maintain SSH access
    sudo ufw allow http         # Port 80, for initial web traffic
    sudo ufw allow https        # Port 443, for secure web traffic
    sudo ufw allow 5060/udp     # For SIP phone calls
    sudo ufw allow 10000:20000/udp # For the actual audio streams (RTP)
    sudo ufw enable             # Enable the firewall
    ```

### Part 2: Install AI Services

These are the external AI models the application depends on.

1.  **Install Whisper (Speech-to-Text):**
    ```bash
    sudo apt install python3 python3-pip ffmpeg -y
    pip3 install -U openai-whisper
    ```
2.  **Install Coqui TTS (Text-to-Speech):** We will use Docker to run the TTS server as a container.
    ```bash
    sudo apt install docker.io -y
    sudo docker run -d -p 5002:5002 --name coqui-tts ghcr.io/coqui-ai/tts-cpu tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC
    ```
3.  **Install LLM (Ollama):** This will be our language model server.
    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ollama pull llama2 # Download the Llama2 model
    ```

### Part 3: Install Core Application Stack

1.  **Install NGINX (Web Server), MySQL (Database), and Node.js (Backend Runtime):**
    ```bash
    sudo apt install nginx mysql-server -y
    sudo mysql_secure_installation # Follow the prompts to set a root password and secure your database.
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    sudo npm install -g pm2 # A process manager to keep the backend running
    ```
2.  **Install Asterisk (Telephony Server):**
    ```bash
    sudo apt install asterisk -y
    sudo systemctl enable asterisk && sudo systemctl start asterisk
    ```

### Part 4: Deploy the Application

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <repo-name>
    ```
2.  **Setup the Database:**
    -   Log in to MySQL as the root user: `sudo mysql -u root -p`
    -   Create the database and a dedicated user for the application. **Use a strong, unique password!**
        ```sql
        CREATE DATABASE ai_call_center;
        CREATE USER 'ai_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
        GRANT ALL PRIVILEGES ON ai_call_center.* TO 'ai_user'@'localhost';
        FLUSH PRIVILEGES;
        EXIT;
        ```
3.  **Configure the Backend:**
    -   Navigate to the `backend` directory: `cd backend`
    -   Copy the example `.env` file: `cp .env.example .env`
    -   Edit the `.env` file (`nano .env`) and fill in all the required values, especially:
        -   `DB_USER`, `DB_PASSWORD`, `DB_NAME` (with the values from the previous step).
        -   `JWT_SECRET` (generate a new long, random string for security).
        -   `AMI_USERNAME` and `AMI_PASSWORD` (create a username and a strong password; you will use these in the Asterisk config next).
        -   The URLs for the AI services (the defaults should be correct if you installed them on the same server).
4.  **Configure Asterisk:**
    -   Copy the provided config files into the Asterisk directory: `sudo cp ../asterisk_config/* /etc/asterisk/`
    -   Edit the manager config file: `sudo nano /etc/asterisk/manager.conf`
        -   Set the `secret` to match the `AMI_PASSWORD` you put in your `.env` file. Set the `user` to match `AMI_USERNAME`.
    -   Set correct file permissions and reload Asterisk:
        ```bash
        sudo chown -R asterisk:asterisk /etc/asterisk
        sudo asterisk -rx "core reload"
        ```
5.  **Install Dependencies and Start Backend:**
    -   From the `backend` directory:
    -   `npm install`
    -   Run the database schema migration script: `bash ../database/install_db.sh`
    -   Create the initial admin user: `node ../scripts/create_admin_user.js admin admin@example.com <your-secure-password>`
    -   Start the backend application with PM2: `pm2 start index.js --name ai-call-center-backend`
    -   Save the process list so it restarts on server boot: `pm2 save && sudo pm2 startup`
6.  **Build and Deploy Frontend:**
    -   Navigate to the frontend directory: `cd ../frontend/ai-call-center-frontend`
    -   Open the production environment file: `nano src/environments/environment.prod.ts`
    -   Change the `apiUrl` to use your public domain name (e.g., `https://your-ai-center.com/api`).
    -   Install dependencies and build the frontend for production:
        ```bash
        npm install
        npm run build -- --configuration production
        ```
7.  **Configure NGINX (the Web Server):**
    -   Copy the provided NGINX config file. **Replace `your-domain.com` with your actual domain name.**
        ```bash
        sudo cp ../../scripts/nginx.conf /etc/nginx/sites-available/your-domain.com
        ```
    -   Edit the file: `sudo nano /etc/nginx/sites-available/your-domain.com`
        -   Change all instances of `your-ai-center.com` to your actual domain name.
        -   Change the `root` path to the **absolute path** of your frontend build directory (e.g., `/home/ubuntu/ai-call-center/frontend/ai-call-center-frontend/dist/ai-call-center-frontend/browser`).
    -   Enable the site by creating a symbolic link: `sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/`
8.  **Setup SSL for HTTPS:**
    -   Install Certbot, a tool to get free SSL certificates: `sudo apt install certbot python3-certbot-nginx -y`
    -   Run Certbot. It will automatically get a certificate and configure NGINX for you.
        ```bash
        sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos -m your-email@example.com --redirect
        ```
    -   Reload NGINX to apply the changes: `sudo systemctl reload nginx`

### Part 5: Final Verification

-   Open your domain in a web browser: `https://your-domain.com`
-   Log in with the admin credentials you created.
-   Use a SIP client (a softphone app on your computer or mobile) to make a test call to the number configured in Asterisk.
-   Check the "Call Logs" page in the Admin UI.
-   Monitor the service logs for errors: `pm2 logs ai-call-center-backend` and `sudo asterisk -rvvv`.

---
This guide provides a complete manual setup. For automated deployments, refer to the `Jenkinsfile` and `terraform/` directory.
---

## Automated Deployment with Jenkins and Terraform

For a more robust and repeatable deployment process, this repository includes files to set up an automated CI/CD pipeline using Jenkins and Terraform.

### Prerequisites

1.  **AWS Account:** You need an AWS account with programmatic access (an Access Key ID and Secret Access Key).
2.  **Jenkins Server:** A running Jenkins server with the "Pipeline" and "Credentials" plugins installed.
3.  **Jenkins Credentials:** You will need to configure the following credentials in Jenkins under "Manage Jenkins" -> "Credentials":
    -   `aws-credentials`: Your AWS Access Key ID and Secret Access Key, stored as an "AWS Credentials" type.
    -   `rds-db-password`: The desired password for your database, stored as a "Secret text" credential.
4.  **Terraform & AWS CLI:** These tools must be installed on the Jenkins agent that will run the pipeline.

### Overview of the Files

-   **`Jenkinsfile`:** This file contains the definition of the CI/CD pipeline. It tells Jenkins what steps to perform, from testing to deployment.
-   **`terraform/` directory:** This directory contains all the Terraform scripts to create the necessary infrastructure on AWS (VPC, EC2 instances, RDS database, etc.).

### How it Works

1.  **Create a new "Pipeline" job in Jenkins.**
2.  **In the pipeline configuration, select "Pipeline script from SCM".**
3.  **Configure the SCM to point to your Git repository.** The "Script Path" should be `Jenkinsfile`.
4.  **Save and run the pipeline.**

The pipeline will perform the following stages automatically:
1.  **Checkout:** Clones the code from your repository.
2.  **Backend CI:** Installs dependencies and runs tests for the backend Node.js application.
3.  **Frontend CI:** Installs dependencies and builds the Angular frontend for production.
4.  **Terraform Plan:** Initializes Terraform and creates a plan of the infrastructure to be created. It will then **pause and wait for your manual approval** before proceeding. This is a critical safety step to prevent accidental changes.
5.  **Terraform Apply:** Once you approve the plan, Jenkins will run Terraform to create or update the infrastructure on AWS.
6.  **Deploy Application:** The pipeline will then deploy the frontend to the S3 bucket and provides a placeholder step for deploying the backend to the EC2 instance. (Note: The backend deployment step in the `Jenkinsfile` is a simplified example; you may need to adapt it to your specific deployment strategy, such as using Ansible, Docker, or custom SSH scripts).
