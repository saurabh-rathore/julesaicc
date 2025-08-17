#!/bin/bash
#
# Script to set up the Application Server for the AI Call Center Application.
# This script installs Node.js, PM2, and Asterisk.
# It is designed to be idempotent where possible.
#
# Usage:
# 1. Copy this script to your Application server.
# 2. Make it executable: chmod +x setup_app_server.sh
# 3. Run with sudo: sudo ./setup_app_server.sh
#

set -e # Exit immediately if a command exits with a non-zero status.

echo "--- Starting Application Server Setup ---"

# --- 1. Install System Dependencies & Node.js ---
echo ">>> Step 1: Installing system dependencies and Node.js..."
apt-get update -y
# software-properties-common is good practice for managing repositories
apt-get install -y software-properties-common

# Install Node.js v18 and npm
if command -v node &> /dev/null
then
    echo "Node.js is already installed."
else
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
    echo ">>> Node.js installed."
fi


# --- 2. Install PM2 ---
echo ">>> Step 2: Installing PM2 process manager globally..."
if command -v pm2 &> /dev/null
then
    echo "PM2 is already installed."
else
    npm install -g pm2
    echo ">>> PM2 installed."
fi


# --- 3. Install Asterisk ---
echo ">>> Step 3: Installing Asterisk..."
if command -v asterisk &> /dev/null
then
    echo "Asterisk is already installed."
else
    apt-get install -y asterisk
    systemctl enable asterisk
    systemctl start asterisk
    echo ">>> Asterisk installed and service started."
fi

echo ""
echo "--- Application Server Setup Complete! ---"
echo "The following should now be installed:"
echo "- Node.js and npm"
echo "- PM2"
echo "- Asterisk (verify with 'systemctl status asterisk')"
