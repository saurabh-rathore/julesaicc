#!/bin/bash

# AI Call Center - Deployment Script for Ubuntu
#
# This script automates the deployment of the AI Call Center application stack.
# It includes: NGINX, MySQL, Node.js, Angular Frontend, Asterisk, and SSL via Let's Encrypt.
#
# Usage:
# 1. Make the script executable: chmod +x deploy.sh
# 2. Run with root privileges: sudo ./deploy.sh your_domain.com your_email@example.com
#
# Prerequisites:
# - An Ubuntu server (tested on 20.04/22.04 LTS).
# - A domain name pointed to your server's IP address for SSL.
# - Root or sudo privileges.
# - Ensure this script and project files are on the server (e.g., via git clone).

set -e # Exit immediately if a command exits with a non-zero status.
# set -x # Print commands and their arguments as they are executed (for debugging).

# --- Configuration ---
APP_DIR=$(pwd) # Assuming script is run from project root
DOMAIN_NAME="$1"
ADMIN_EMAIL="$2" # For Let's Encrypt

NODE_VERSION="18" # Specify Node.js version
APP_USER="app_user" # Dedicated user for running the application (optional but recommended)

# Backend config
BACKEND_DIR="$APP_DIR/backend"
BACKEND_PORT="3000" # Should match backend/.env PORT

# Frontend config
FRONTEND_DIR="$APP_DIR/frontend/ai-call-center-frontend" # Path to Angular app
FRONTEND_BUILD_DIR="$FRONTEND_DIR/dist/ai-call-center-frontend/browser" # Default Angular build output

# Asterisk config
ASTERISK_CONFIG_DIR="$APP_DIR/asterisk_config"
ASTERISK_SYSTEM_CONFIG_DIR="/etc/asterisk"

# MySQL Credentials (ideally use .env or prompt, but for automation, can be set here or passed)
# These should match those in backend/.env and database/install_db.sh if it reads them
DB_ROOT_PASSWORD=$(openssl rand -hex 12)
DB_APP_USER="ai_call_center_user"
DB_APP_PASSWORD=$(openssl rand -hex 12)
DB_NAME="ai_call_center"

# --- Helper Functions ---
print_message() {
  echo "----------------------------------------------------"
  echo "$1"
  echo "----------------------------------------------------"
}

check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo." >&2
    exit 1
  fi
}

validate_params() {
  if [ -z "$DOMAIN_NAME" ] || [ -z "$ADMIN_EMAIL" ]; then
    echo "Usage: sudo $0 <your_domain.com> <your_email@example.com>"
    exit 1
  fi
}

# --- Main Deployment Steps ---

main() {
  check_root
  validate_params

  print_message "Starting AI Call Center Deployment"

  # 0. Create dedicated application user (optional)
  # if ! id "$APP_USER" &>/dev/null; then
  #   print_message "Creating application user '$APP_USER'..."
  #   useradd -r -s /bin/false "$APP_USER"
  # fi

  # 1. Update System and Install Base Dependencies
  print_message "Updating system packages and installing base dependencies..."
  apt-get update -y
  apt-get upgrade -y
  apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates build-essential git nginx

  # 2. Install MySQL Server
  print_message "Installing MySQL Server..."
  apt-get install -y mysql-server
  # Secure MySQL installation (non-interactive example - adjust as needed)
  # mysql_secure_installation # This is interactive. For automation:
  # Consider: debconf-set-selections for unattended install or use mysql -e commands.
  # Example of setting root password (less secure than manual or debconf)
  # mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_ROOT_PASSWORD}';"
  # mysql -e "FLUSH PRIVILEGES;"
  print_message "MySQL installed. Manual secure installation recommended: sudo mysql_secure_installation"


  # 3. Install Node.js
  print_message "Installing Node.js (version $NODE_VERSION)..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  apt-get install -y nodejs
  npm install -g pm2 # Process manager for Node.js app

  # 4. Install Asterisk
  print_message "Installing Asterisk..."
  # Add Asterisk PPA or compile from source if specific version needed.
  # For simplicity, using Ubuntu's packaged version (might be older)
  apt-get install -y asterisk asterisk-mysql # asterisk-mysql for database connectivity if needed by dialplan (e.g. func_odbc)
  # Ensure Asterisk service is enabled and started
  systemctl enable asterisk
  systemctl start asterisk
  print_message "Asterisk installation initiated. Further configuration required."

  # 5. Setup Database
  print_message "Setting up MySQL database and user..."
  # Ensure .env file is present for install_db.sh or pass credentials
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env" # Assuming .env.example exists
  # TODO: Update .env with actual DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET etc.
  # For now, we'll use the script variables.

  mysql -u root -p"${DB_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -u root -p"${DB_ROOT_PASSWORD}" -e "CREATE USER IF NOT EXISTS '${DB_APP_USER}'@'localhost' IDENTIFIED BY '${DB_APP_PASSWORD}';"
  mysql -u root -p"${DB_ROOT_PASSWORD}" -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_APP_USER}'@'localhost';"
  mysql -u root -p"${DB_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;"

  # Populate .env for backend (replace placeholders)
  # This is a critical step and needs careful handling of secrets.
  # For now, assume backend/.env is manually prepared or has defaults that are overridden by script vars.
  # Example of setting values in backend/.env (use with caution, consider sed or other tools)
  # sed -i "s/DB_USER=.*/DB_USER=${DB_APP_USER}/" "$BACKEND_DIR/.env"
  # sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_APP_PASSWORD}/" "$BACKEND_DIR/.env"
  # sed -i "s/DB_NAME=.*/DB_NAME=${DB_NAME}/" "$BACKEND_DIR/.env"
  # A strong JWT_SECRET should be generated:
  # JWT_SECRET_VALUE=$(openssl rand -hex 32)
  # sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET_VALUE}/" "$BACKEND_DIR/.env"

  print_message "Running database schema installation..."
  # Ensure install_db.sh uses the correct credentials. It's written to pick from .env
  # We need to make sure the .env in database/ or backend/ has the right DB_USER/DB_PASSWORD for schema install.
  # The install_db.sh expects DB_USER and DB_PASSWORD to connect.
  # For simplicity, if install_db.sh uses the root user for setup, ensure it has the root password.
  # Or, modify install_db.sh to take credentials as parameters.
  # Current install_db.sh tries to load .env. Let's assume backend/.env is configured with DB_APP_USER.
  # The schema.sql itself creates the DB if not exists, so DB_APP_USER needs CREATE DB rights or DB must exist.
  # The previous MySQL commands already created the DB and granted privileges.

  # Temporarily set env vars for install_db.sh if it can't find the .env
  export DB_USER="$DB_APP_USER"
  export DB_PASSWORD="$DB_APP_PASSWORD"
  export DB_HOST="localhost"
  export DB_NAME="$DB_NAME"
  bash "$APP_DIR/database/install_db.sh"
  unset DB_USER DB_PASSWORD DB_HOST DB_NAME

  # 6. Deploy Backend Application
  print_message "Deploying Node.js backend application..."
  cd "$BACKEND_DIR"
  npm install --omit=dev # Install production dependencies
  # Ensure .env file is correctly configured here.

  # Start application with PM2
  # Check if app is already running
  pm2 describe ai-call-center-backend > /dev/null
  if [ $? -eq 0 ]; then
    pm2 reload ai-call-center-backend --update-env
  else
    pm2 start index.js --name ai-call-center-backend -- --env production # Pass --env production to app if it uses it
    pm2 save # Save current process list
    pm2 startup # Enable PM2 to start on system boot
  fi
  cd "$APP_DIR"

  # 7. Build and Deploy Frontend Application
  print_message "Building and deploying Angular frontend application..."
  cd "$FRONTEND_DIR"
  npm install # Install Angular CLI and dependencies
  npm run build -- --configuration production # Build for production
  cd "$APP_DIR"
  # NGINX will be configured to serve files from $FRONTEND_BUILD_DIR

  # 8. Configure Asterisk
  print_message "Configuring Asterisk..."
  # Backup existing Asterisk configs (optional but recommended)
  # cp -r "$ASTERISK_SYSTEM_CONFIG_DIR" "$ASTERISK_SYSTEM_CONFIG_DIR.bak_$(date +%F-%T)"

  # Copy custom configuration files
  # Ensure these files have correct ownership/permissions (e.g., asterisk:asterisk)
  cp "$ASTERISK_CONFIG_DIR/sip.conf" "$ASTERISK_SYSTEM_CONFIG_DIR/sip.conf"
  cp "$ASTERISK_CONFIG_DIR/extensions.conf" "$ASTERISK_SYSTEM_CONFIG_DIR/extensions.conf"
  cp "$ASTERISK_CONFIG_DIR/manager.conf" "$ASTERISK_SYSTEM_CONFIG_DIR/manager.conf"
  # Potentially other files like queues.conf, voicemail.conf, musiconhold.conf etc.

  # Set permissions (Asterisk usually runs as 'asterisk' user)
  chown -R asterisk:asterisk "$ASTERISK_SYSTEM_CONFIG_DIR"
  chmod -R u=rwX,g=rX,o= "$ASTERISK_SYSTEM_CONFIG_DIR" # Restrictive permissions

  print_message "Reloading Asterisk configuration..."
  asterisk -rx "core reload"
  # May need specific reloads:
  # asterisk -rx "sip reload"
  # asterisk -rx "dialplan reload"
  # asterisk -rx "manager reload"

  # 9. Configure NGINX
  print_message "Configuring NGINX..."
  # Remove default site
  rm -f /etc/nginx/sites-enabled/default

  # Create NGINX config file for the application
  cat > /etc/nginx/sites-available/"$DOMAIN_NAME" <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Redirect HTTP to HTTPS (Certbot will handle this later, but good as a base)
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2; # Will be configured by Certbot
    server_name $DOMAIN_NAME;

    # SSL settings will be added by Certbot
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root $FRONTEND_BUILD_DIR;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:$BACKEND_PORT; # Backend API
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Additional locations for Asterisk WebSocket (for WebRTC, if needed later)
    # location /ws {
    #    proxy_pass http://127.0.0.1:8088/ws; # Asterisk HTTP server with WebSocket
    #    proxy_http_version 1.1;
    #    proxy_set_header Upgrade \$http_upgrade;
    #    proxy_set_header Connection "upgrade";
    #    proxy_read_timeout 86400; # Keep connection open
    # }
}
EOF

  ln -sf /etc/nginx/sites-available/"$DOMAIN_NAME" /etc/nginx/sites-enabled/
  nginx -t # Test NGINX configuration
  systemctl reload nginx

  # 10. Setup SSL with Let's Encrypt
  print_message "Setting up SSL with Let's Encrypt..."
  apt-get install -y certbot python3-certbot-nginx
  # Certbot will modify the NGINX configuration to enable SSL
  certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect
  # Setup auto-renewal for Certbot
  systemctl enable certbot.timer
  systemctl start certbot.timer

  print_message "NGINX reloaded with SSL configuration."
  systemctl reload nginx

  print_message "Deployment Complete!"
  echo "Your application should be accessible at https://$DOMAIN_NAME"
  echo "Backend API is proxied under https://$DOMAIN_NAME/api"
  echo "Ensure your DNS records for $DOMAIN_NAME are correctly pointing to this server's IP."
  echo "Review all security settings, especially passwords and firewall rules."
}

# --- Run Script ---
main "$@"

# --- Post-Deployment Notes ---
# - Firewall: Ensure UFW or iptables is configured to allow traffic on ports 80, 443,
#   and any necessary SIP/RTP ports for Asterisk (e.g., 5060/UDP, 10000-20000/UDP for RTP).
#   Example UFW:
#   sudo ufw allow ssh
#   sudo ufw allow http
#   sudo ufw allow https
#   sudo ufw allow 5060/udp
#   sudo ufw allow 10000:20000/udp
#   sudo ufw enable
#
# - Monitoring: Consider setting up monitoring for NGINX, Node.js app (PM2 logs), Asterisk, and MySQL.
#
# - Backups: Implement a backup strategy for your database and application files.
#
# - .env files: Ensure all .env files (backend, database script context) are correctly
#   configured with production secrets and are NOT committed to version control if they contain sensitive info.
#   Use .env.example files as templates.
#
# - Asterisk Security: Further harden Asterisk (e.g., fail2ban, secure RTP, TLS for SIP).
#   Review Asterisk logs in /var/log/asterisk/ for any issues.
#
# - Node.js Application: Check PM2 logs for backend status: pm2 logs ai-call-center-backend
#
# - Test thoroughly!
