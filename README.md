# AI-Powered Voice Call Center

## Project Overview

This project implements an intelligent, multilingual AI-powered voice call center platform. It's designed to autonomously interact with customers via voice (SIP/VoIP), understand their queries using Speech-to-Text (STT) and a Large Language Model (LLM), respond in a natural human-like voice using Text-to-Speech (TTS), and escalate to human agents when necessary. The system includes an Admin UI for management and analytics.

## Core Features

*   **Voice Interaction:** Handles SIP/VoIP calls via Asterisk.
*   **Speech-to-Text:** Transcribes customer audio using Whisper.
*   **Natural Language Understanding & Response:** Processes queries and generates responses using an LLM.
*   **Text-to-Speech:** Converts LLM text responses to voice using Coqui TTS.
*   **Multilingual Support:** Designed to handle multiple languages throughout the pipeline.
*   **Customer Plan Lookup:** Enriches LLM context with customer plan details.
*   **Call Escalation:** Allows transfer to human agents.
*   **Call Logging & Transcripts:** Stores call metadata and full transcripts.
*   **Feedback Mechanism:** Allows for call rating and comments.
*   **Analytics & Reporting:** Provides insights via an Admin UI (Dashboard).
*   **Admin UI:** Web-based interface for monitoring and management.

## Project Structure

```
.
├── asterisk_config/      # Example Asterisk configuration files
│   ├── extensions.conf
│   ├── manager.conf
│   ├── queues.conf
│   └── sip.conf
├── backend/              # Node.js/Express backend application
│   ├── config/           # Database configuration, etc.
│   ├── controllers/      # Request handlers for API routes
│   ├── middleware/       # Custom middleware (e.g., auth)
│   ├── models/           # (If using an ORM, otherwise schema is in /database)
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic (AMI, STT, LLM, TTS, Call, User, etc.)
│   ├── tests/            # Backend unit/integration tests
│   ├── utils/            # Utility functions (e.g., JWT handling)
│   ├── .env.example      # Example environment variables
│   ├── .gitignore
│   ├── index.js          # Main entry point for the backend
│   └── package.json
├── database/             # Database schema and setup scripts
│   ├── install_db.sh
│   └── schema.sql
├── frontend/             # Angular frontend application (Admin UI)
│   └── ai-call-center-frontend/ # Angular project root
│       ├── src/
│       │   ├── app/
│       │   │   ├── components/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   ├── services/
│       │   │   └── ...
│       │   ├── assets/
│       │   └── environments/
│       ├── .editorconfig
│       ├── .gitignore
│       ├── angular.json
│       └── package.json
├── scripts/              # Deployment and utility scripts
│   ├── create_admin_user.js
│   └── deploy.sh
└── README.md             # This file
```

## Technical Stack

*   **Telephony:** Asterisk (for SIP/VoIP call handling)
*   **Backend:** Node.js, Express.js
*   **Frontend (Admin UI):** Angular
*   **Database:** MySQL
*   **Speech-to-Text (STT):** Whisper (OpenAI)
*   **Text-to-Speech (TTS):** Coqui TTS
*   **Language Model (LLM):** Configurable (e.g., local Ollama with Llama 2, or other open-source/commercial models)
*   **Authentication:** JWT (JSON Web Tokens)
*   **Deployment:** Ubuntu (EC2 on AWS), NGINX (as reverse proxy)

## Setup and Installation

### Prerequisites

*   Node.js (v18+ recommended)
*   NPM (or Yarn)
*   MySQL Server
*   Asterisk
*   Whisper (CLI tool or accessible API)
*   Coqui TTS (server or accessible API)
*   An LLM (e.g., Ollama running a model like Llama2)
*   (Optional but Recommended) PM2 for Node.js process management

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>/backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:**
    *   Copy `.env.example` to `.env`.
    *   Update `.env` with your database credentials, JWT secret, AMI credentials, TTS URL, LLM URL, etc.
    ```
    PORT=3000
    JWT_SECRET=yourverysecretkey # Change this!
    JWT_EXPIRES_IN=1h

    DB_HOST=localhost
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=ai_call_center

    AMI_HOST=localhost
    AMI_PORT=5038
    AMI_USERNAME=your_ami_user    # Must match manager.conf
    AMI_PASSWORD=your_ami_secret  # Must match manager.conf

    ASTERISK_QUEUE_CONTEXT=queues
    ASTERISK_QUEUE_NAME=support-queue

    COQUI_TTS_URL=http://localhost:5002/api/tts # Adjust if different
    TTS_AUDIO_PATH=/tmp/tts_audio # Ensure this is writable

    WHISPER_MODEL=base.en # Or your preferred Whisper model
    RECORDING_PATH=/tmp/asterisk_recordings # Ensure this is writable

    LLM_API_URL=http://localhost:11434/api/generate # Example for Ollama
    LLM_MODEL_NAME=llama2 # Or your preferred model
    # LLM_API_KEY= # If your LLM requires an API key
    ```
4.  **Setup Database:**
    *   Ensure MySQL server is running.
    *   Navigate to the `database` directory: `cd ../database`
    *   Make `install_db.sh` executable: `chmod +x install_db.sh`
    *   Run the script (it uses credentials from `backend/.env` or defaults): `./install_db.sh`
    *   Alternatively, manually execute `schema.sql` against your MySQL server.

5.  **Create Initial Admin User (Backend):**
    *   Navigate to the `scripts` directory: `cd ../scripts`
    *   Run the script: `node create_admin_user.js <username> <email> <password>`
    *   Example: `node create_admin_user.js admin admin@example.com securepass123`

6.  **Start the Backend Server:**
    *   Navigate back to the `backend` directory: `cd ../backend`
    *   For development: `npm run dev` (uses nodemon if configured)
    *   For production: `npm start` (or use PM2: `pm2 start index.js --name ai-call-center-backend`)

### Frontend Setup (Admin UI)

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend/ai-call-center-frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment (if needed):**
    *   The `AuthService` currently hardcodes the API URL (`http://localhost:3000/api/auth`). For production, this should be configured via Angular's environment files (`src/environments/`).
4.  **Run the Angular development server:**
    ```bash
    ng serve
    ```
    The Admin UI will typically be available at `http://localhost:4200/`.

### Asterisk Setup

1.  **Install Asterisk:** Follow instructions for your OS.
2.  **Configure Asterisk:**
    *   Copy or link the configuration files from the `asterisk_config` directory of this project to your Asterisk configuration directory (usually `/etc/asterisk/`).
        *   `sip.conf`
        *   `extensions.conf` (ensure `#include "queues.conf"` is present or handle includes via `asterisk.conf`)
        *   `manager.conf` (update username/password to match `backend/.env` `AMI_USERNAME`/`AMI_PASSWORD` and set `permit` rules)
        *   `queues.conf`
    *   Ensure any custom sound files referenced in `extensions.conf` (e.g., `queue-thankyou`, `custom/agent-greeting`) are placed in Asterisk's sounds directory (e.g., `/var/lib/asterisk/sounds/en/custom/`).
3.  **Reload Asterisk:**
    ```bash
    sudo asterisk -rx "core reload"
    # Or more specific reloads:
    # sudo asterisk -rx "sip reload"
    # sudo asterisk -rx "dialplan reload"
    # sudo asterisk -rx "manager reload"
    ```

### External Services Setup

*   **Whisper:** Ensure the Whisper CLI is installed and accessible in the system PATH where the Node.js backend runs, or that a Whisper API is available and configured in `.env`.
*   **Coqui TTS:** Ensure a Coqui TTS server is running and accessible at the URL specified in `COQUI_TTS_URL` in the backend's `.env` file. Make sure it has the required voice models for the languages you intend to use.
*   **LLM:** Ensure your chosen LLM is running and accessible at the URL specified in `LLM_API_URL`. For Ollama, ensure the model specified in `LLM_MODEL_NAME` is pulled (`ollama pull llama2`).

## API Documentation

(Placeholder: API documentation will be added here. Consider using Swagger/OpenAPI.)

*   `/api/auth/login` (POST): Login user.
*   `/api/auth/register` (POST): Register new user (admin only or via script).
*   `/api/auth/me` (GET): Get current user profile.
*   `/api/calls` (POST): Create a call log.
*   `/api/calls` (GET): Get all call logs (supports pagination & filtering).
*   `/api/calls/:id` (GET): Get a single call log by ID.
*   `/api/calls/:id` (PUT): Update a call log.
*   `/api/calls/:id/transcripts` (GET): Get transcripts for a call.
*   `/api/feedback` (POST): Submit feedback for a call.
*   `/api/feedback/call/:callId` (GET): Get feedback for a specific call.
*   `/api/feedback` (GET): Get all feedback entries.
*   `/api/analytics/stats` (GET): Get overall call statistics.
*   `/api/analytics/resolution-rates` (GET): Get AI vs Human resolution rates.
*   `/api/analytics/feedback-summary` (GET): Get feedback summary.

## Deployment

Refer to the `scripts/deploy.sh` script for an example of deploying the application stack on an Ubuntu server using NGINX as a reverse proxy and Let's Encrypt for SSL. This script is a starting point and may need customization.

**Key deployment components:**
*   NGINX (reverse proxy, SSL termination, serving frontend)
*   MySQL Server
*   Node.js application (run with PM2)
*   Asterisk
*   Whisper, Coqui TTS, LLM services

## Contributing

(Details on how to contribute, coding standards, etc., would go here.)

## License

(Specify project license, e.g., MIT, Apache 2.0.)

---

This README provides a comprehensive overview. Specific READMEs within `backend/` and `frontend/ai-call-center-frontend/` will contain more detailed information about those components.
