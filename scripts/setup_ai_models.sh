#!/bin/bash
#
# Script to set up the AI/ML Server for the AI Call Center Application.
# This script installs all necessary software and downloads the required AI models.
# It is designed to be idempotent, meaning it can be run multiple times safely.
#
# Usage:
# 1. Copy this script to your AI/ML server.
# 2. Make it executable: chmod +x setup_ai_models.sh
# 3. Run with sudo: sudo ./setup_ai_models.sh
#

set -e # Exit immediately if a command exits with a non-zero status.

echo "--- Starting AI/ML Server Setup ---"

# --- 1. Install System Dependencies ---
echo ">>> Step 1: Installing system dependencies (Docker, Python, ffmpeg)..."
apt-get update -y
apt-get install -y docker.io python3 python3-pip ffmpeg
echo ">>> System dependencies installed."

# --- 2. Install Python AI Libraries ---
echo ">>> Step 2: Installing Python AI libraries (Whisper)..."
pip3 install -U openai-whisper
echo ">>> Python AI libraries installed."

# --- 3. Install and Run Coqui TTS Server ---
echo ">>> Step 3: Setting up Coqui TTS server via Docker..."
# Check if the container is already running
if [ "$(docker ps -q -f name=coqui-tts)" ]; then
    echo "Coqui TTS container is already running."
else
    echo "Starting Coqui TTS container..."
    # This command downloads the Coqui TTS docker image and starts the server.
    docker run -d -p 5002:5002 --name coqui-tts ghcr.io/coqui-ai/tts-cpu tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC
    echo "Coqui TTS container started."
fi

# --- 4. Install and Run Ollama Service ---
echo ">>> Step 4: Setting up Ollama service..."
if command -v ollama &> /dev/null
then
    echo "Ollama is already installed."
else
    echo "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "Ollama installed and service started."
fi

# --- 5. Download LLM Model ---
echo ">>> Step 5: Downloading LLM model (llama2)..."
# This command will pull the model if it doesn't already exist.
ollama pull llama2
echo ">>> LLM model is ready."

echo ""
echo "--- AI/ML Server Setup Complete! ---"
echo "The following services should now be running:"
echo "- Coqui TTS on port 5002 (verify with 'sudo docker ps')"
echo "- Ollama service (verify with 'systemctl status ollama')"
echo "The 'whisper' command should be available in the path."
