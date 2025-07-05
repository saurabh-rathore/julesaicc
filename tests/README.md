# Testing Strategy - AI Call Center

This document outlines the testing strategy for the AI Call Center application. Comprehensive testing is crucial to ensure reliability, functionality, and performance.

## 1. Unit Tests

-   **Backend (Node.js/Express):**
    -   **Framework:** Jest (or Mocha/Chai)
    -   **Scope:** Test individual functions, modules, controllers, services, and middleware.
    -   **Focus:** Business logic, input validation, error handling, interactions with mocks/stubs for external services (DB, AMI, TTS/STT APIs).
    -   **Location:** `backend/tests/` or `backend/**/__tests__/`
    -   **Execution:** `npm test` in the `backend` directory.
    -   **Examples:**
        -   Test API endpoint handlers with mock request/response objects.
        -   Verify correct JWT generation and validation.
        -   Test database query functions with a test database or mocked responses.
        -   Ensure AMI command formatting is correct.

-   **Frontend (Angular):**
    -   **Framework:** Jasmine and Karma (default with Angular CLI)
    -   **Scope:** Test individual components, services, pipes, and guards.
    -   **Focus:** Component rendering, user interactions (mocked), service method logic, data transformations.
    -   **Location:** `*.spec.ts` files alongside the source files in `frontend/ai-call-center-frontend/src/app/`.
    -   **Execution:** `ng test` in the `frontend/ai-call-center-frontend` directory.
    -   **Examples:**
        -   Component correctly displays input data.
        -   Service fetches and processes data as expected (using `HttpClientTestingModule`).
        -   Form validation works correctly.
        -   Route guards permit or deny access based on conditions.

## 2. Integration Tests

-   **Scope:** Test interactions between different parts of the system.
    -   Backend API endpoints interacting with the database.
    -   Backend interaction with Asterisk Management Interface (AMI).
    -   Backend interaction with external STT/TTS/LLM services (using test/dev keys or mocked endpoints).
    -   Frontend services making calls to the live backend API (on a test environment).
-   **Tools:**
    -   Backend: Supertest for API endpoint testing, Jest/Mocha for orchestration.
    -   Frontend: Protractor or Cypress for testing Angular app against a live backend.
-   **Focus:** Data flow, API contracts, service communication, error propagation across components.

## 3. End-to-End (E2E) Tests

-   **Scope:** Simulate full user scenarios from the frontend UI through the backend and external services.
-   **Tools:** Cypress or Protractor for frontend E2E testing. For voice call scenarios, this is more complex and might involve specialized VoIP testing tools or manual testing scripts.
-   **Focus:**
    -   User login and navigation in the Admin UI.
    -   Viewing call logs and analytics.
    -   Simulating an incoming call and verifying:
        -   Call routing in Asterisk.
        -   Backend processing (mocked AI responses initially).
        -   Transcription logging (mocked).
        -   TTS playback (verified by logs or intermediate audio files).
        -   Call escalation flow.
-   **Challenges:** Automating voice call E2E tests is complex. Initial E2E tests might focus on the Admin UI and API interactions, with call flows tested manually or via simulated inputs.

## 4. Performance Tests

-   **Scope:** Test the system's responsiveness and stability under load.
-   **Tools:** k6, JMeter, or similar for API load testing. SIPp for Asterisk load testing.
-   **Focus:**
    -   API response times under concurrent requests.
    -   Database performance with large datasets.
    -   Asterisk call handling capacity.
    -   Resource utilization (CPU, memory) on the server.

## 5. Security Testing

-   **Scope:** Identify and mitigate security vulnerabilities.
-   **Areas:**
    -   Authentication and authorization mechanisms (JWT, API access).
    -   Input validation to prevent injection attacks (SQLi, XSS).
    -   Secure configuration of Asterisk (TLS for SIP, SRTP, AMI access).
    -   Protection against denial-of-service attacks.
    -   Data privacy and protection (e.g., for call recordings, transcripts).
-   **Tools:** OWASP ZAP, npm audit, manual penetration testing.

## Test Execution and CI/CD

-   Unit tests should be run automatically on every commit/push.
-   Integration and E2E tests can be run on a staging environment as part of a CI/CD pipeline.
-   Regularly review test coverage and update tests as the application evolves.

This testing strategy provides a framework. Specific test cases and priorities will be determined based on project requirements and risk assessment.
