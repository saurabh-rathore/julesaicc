# AI Call Center - Backend

This directory contains the Node.js/Express backend application for the AI Call Center.

## Overview

The backend is responsible for:
*   Handling API requests from the Admin UI (Frontend).
*   Managing user authentication and authorization (JWT).
*   Interacting with the MySQL database for data storage (users, calls, transcripts, feedback, customer plans).
*   Integrating with Asterisk via the Asterisk Manager Interface (AMI) for call control, event monitoring, and initiating actions like recording or playback.
*   Orchestrating the AI call flow:
    *   Using a Speech-to-Text (STT) service (Whisper) to transcribe customer audio.
    *   Querying a Large Language Model (LLM) for intent understanding and response generation.
    *   Using a Text-to-Speech (TTS) service (Coqui TTS) to synthesize AI responses.
*   Logging call details, transcripts, and feedback.
*   Providing data for analytics and reporting.

## Project Structure

*   `config/`: Database connection (`db.js`), and potentially other configurations.
*   `controllers/`: Route handlers that process incoming requests, interact with services, and send responses. (e.g., `authController.js`, `callController.js`, `analyticsController.js`, `feedbackController.js`)
*   `middleware/`: Custom middleware functions, primarily `authMiddleware.js` for JWT verification.
*   `models/`: (Currently not using a traditional ORM, database schema is in `database/schema.sql`). This directory could be used if an ORM like Sequelize or TypeORM is introduced.
*   `routes/`: Defines the API endpoints and maps them to controller functions. (e.g., `authRoutes.js`, `callRoutes.js`, etc.)
*   `services/`: Contains the core business logic and interactions with external systems or databases.
    *   `userService.js`: Manages user data and authentication logic.
    *   `callService.js`: Manages call logs and transcripts.
    *   `amiService.js`: Handles connection and communication with Asterisk Manager Interface.
    *   `sttService.js`: Integrates with Whisper for speech-to-text.
    *   `llmService.js`: Integrates with the chosen LLM.
    *   `ttsService.js`: Integrates with Coqui TTS for text-to-speech.
    *   `aiCallHandlerService.js`: Orchestrates the AI call flow.
    *   `customerPlanService.js`: Manages customer plan lookups.
    *   `feedbackService.js`: Manages call feedback.
    *   `analyticsService.js`: Provides data for analytics.
*   `tests/`: Contains unit and integration tests for the backend components. Organized by component type (controllers, services, utils, middleware).
*   `utils/`: Utility functions, such as `jwtUtils.js` for handling JWTs.
*   `__mocks__/`: Directory for Jest manual mocks.
*   `.env.example`: Template for environment variables. Create a `.env` file based on this.
*   `index.js`: The main entry point for the Express application. Sets up middleware, routes, database connection, and starts the server.
*   `package.json`: Project dependencies and scripts.

## Setup and Running

1.  **Prerequisites:**
    *   Node.js (v18+ recommended)
    *   NPM (or Yarn)
    *   MySQL Server running and accessible.
    *   Asterisk server running and configured (see `asterisk_config/README.md` and main project README).
    *   Whisper, Coqui TTS, and LLM services configured and accessible as per `.env` settings.

2.  **Installation:**
    *   Navigate to the `backend` directory.
    *   Install dependencies: `npm install`

3.  **Environment Variables:**
    *   Copy `.env.example` to `.env`.
    *   Edit `.env` and fill in the required values:
        *   `PORT`: Port for the backend server (e.g., 3000).
        *   `JWT_SECRET`: A strong secret key for signing JWTs.
        *   `JWT_EXPIRES_IN`: Token expiration time (e.g., `1h`, `7d`).
        *   `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL connection details.
        *   `AMI_HOST`, `AMI_PORT`, `AMI_USERNAME`, `AMI_PASSWORD`: Asterisk Manager Interface credentials (must match `manager.conf`).
        *   `ASTERISK_QUEUE_CONTEXT`, `ASTERISK_QUEUE_NAME`: For call escalation.
        *   `COQUI_TTS_URL`: URL for your Coqui TTS server API.
        *   `TTS_AUDIO_PATH`: Writable path for temporary TTS audio files.
        *   `WHISPER_MODEL`: Whisper model to use (e.g., `base.en`, `small`).
        *   `RECORDING_PATH`: Writable path for Asterisk call recordings.
        *   `LLM_API_URL`: URL for your LLM API.
        *   `LLM_MODEL_NAME`: Name of the LLM model to use.
        *   `LLM_API_KEY`: (Optional) API key if your LLM requires it.

4.  **Database Setup:**
    *   The database schema is defined in `../database/schema.sql`.
    *   The `../database/install_db.sh` script can be used to create the database and tables. Ensure it has execute permissions (`chmod +x install_db.sh`) and that the `.env` file in the `backend` directory is configured with correct DB credentials (the script attempts to read it).

5.  **Create Initial Admin User:**
    *   Use the script provided in the main project: `node ../scripts/create_admin_user.js <username> <email> <password>`
    *   Example: `node ../scripts/create_admin_user.js admin admin@example.com mysecretpassword`

6.  **Running the Server:**
    *   **Development:** `npm run dev` (This typically uses `nodemon` for auto-restarting the server on file changes. Install `nodemon` globally or as a dev dependency: `npm install -g nodemon` or `npm install --save-dev nodemon`).
    *   **Production:** `npm start` (This runs `node index.js`). For production deployments, using a process manager like PM2 is highly recommended:
        ```bash
        pm2 start index.js --name ai-call-center-backend
        pm2 startup
        pm2 save
        ```

## API Endpoints

The backend exposes RESTful APIs for various functionalities. These are defined in the `routes/` directory. Key base paths include:

*   `/api/auth`: Authentication (login, register, user profile).
*   `/api/calls`: Call log management and transcript retrieval.
*   `/api/feedback`: Submitting and retrieving call feedback.
*   `/api/analytics`: Retrieving analytics data.

Refer to the main project `README.md` or specific route files for detailed endpoint definitions. (Future: Link to Swagger/OpenAPI documentation).

## Testing

*   Unit tests are located in the `tests/` directory, organized by the type of module being tested (controllers, services, etc.).
*   To run all backend tests:
    ```bash
    npm test
    ```
*   To run a specific test file:
    ```bash
    npm test <path_to_test_file.js>
    ```
    Example: `npm test tests/services/userService.test.js`

(Note: As of the current development stage, some unit tests might be deferred. The goal is to have comprehensive test coverage.)
