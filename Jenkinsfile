// Declarative Jenkinsfile for the AI Call Center Application
// This pipeline automates the build, test, and deployment process.

pipeline {
    agent any

    environment {
        // These credentials should be configured in the Jenkins Credentials Manager
        // and then injected into the pipeline environment.
        // - 'aws-credentials': A "Username with password" or "AWS Credentials" type for AWS CLI access.
        // - 'rds-db-password': A "Secret text" credential for the database password.
        AWS_CREDENTIALS     = credentials('aws-credentials')
        TF_VAR_db_password  = credentials('rds-db-password')
        AWS_REGION          = 'us-east-1'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Backend CI') {
            steps {
                echo 'Building and testing the backend...'
                dir('backend') {
                    sh 'npm install'
                    sh 'npm test'
                }
            }
        }

        stage('Frontend CI') {
            steps {
                echo 'Building the frontend...'
                dir('frontend/ai-call-center-frontend') {
                    sh 'npm install'
                    sh 'npm run build -- --configuration production'
                }
            }
        }

        stage('Terraform Plan') {
            steps {
                echo 'Running Terraform plan to preview infrastructure changes...'
                dir('terraform') {
                    // Initialize Terraform
                    sh 'terraform init'
                    // Create a plan and save it to a file
                    sh 'terraform plan -out=tfplan'
                }
                // This crucial step waits for a human to manually approve the plan before applying it.
                // This prevents accidental infrastructure changes.
                input 'Deploy infrastructure to AWS?'
            }
        }

        stage('Terraform Apply') {
            steps {
                echo 'Applying Terraform plan to create/update infrastructure...'
                dir('terraform') {
                    // Apply the saved plan
                    sh 'terraform apply -auto-approve tfplan'
                }
            }
        }

        stage('Deploy Application') {
            // This stage deploys the application code to the newly created infrastructure.
            // In a real-world scenario, this would be more robust, likely using Ansible, Packer, or Docker containers.
            parallel {
                stage('Deploy Frontend to S3') {
                    steps {
                        echo 'Deploying frontend build artifacts to the S3 bucket...'
                        dir('terraform') {
                            // Get the bucket name from Terraform output and sync the files
                            sh '''
                                BUCKET_NAME=$(terraform output -raw frontend_s3_bucket_name)
                                aws s3 sync ../frontend/ai-call-center-frontend/dist/ai-call-center-frontend/browser/ s3://${BUCKET_NAME}/ --delete
                            '''
                        }
                    }
                }
                stage('Deploy Backend & Asterisk') {
                    steps {
                        echo 'Deploying backend code and Asterisk configuration...'
                        dir('terraform') {
                            // This is a simplified example using SSH.
                            // A better approach is to build a custom AMI with Packer or deploy a Docker container to ECS/EKS.
                            sh '''
                                APP_SERVER_IP=$(terraform output -raw app_server_public_ip)
                                echo "Deploying to App Server at ${APP_SERVER_IP}"

                                # The following is a placeholder for your deployment script.
                                # You would typically use a configuration management tool like Ansible here.
                                # ssh -o StrictHostKeyChecking=no -i ~/.ssh/your-key.pem ubuntu@${APP_SERVER_IP} "
                                #   set -e
                                #   cd /home/ubuntu/ai-call-center
                                #   git pull origin main
                                #   cd backend
                                #   npm install
                                #   pm2 reload all
                                #   sudo cp ../asterisk_config/* /etc/asterisk/
                                #   sudo asterisk -rx \'core reload\'
                                # "
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
            // You could add cleanup steps here, e.g., deleting the terraform plan file.
            dir('terraform') {
                sh 'rm -f tfplan'
            }
        }
    }
}
