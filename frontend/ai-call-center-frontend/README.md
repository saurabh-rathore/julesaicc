# AI Call Center - Frontend (Admin UI)

This directory contains the Angular frontend application for the AI Call Center's Admin UI.

## Overview

The Admin UI provides administrators and authorized personnel with tools to:
*   Log in securely.
*   View call logs and detailed call transcripts.
*   Monitor call analytics and key performance indicators.
*   Manage user feedback (view, and potentially in the future, respond or categorize).
*   (Future) Control fine-tuning parameters for AI models.
*   (Future) Manage users and system settings.

## Technical Stack

*   **Framework:** Angular (latest stable version, configured for standalone components)
*   **Styling:** SCSS
*   **HTTP Client:** Angular's `HttpClient` for communication with the backend API.
*   **Routing:** Angular Router for navigation.
*   **Forms:** Angular Reactive Forms for input handling (e.g., login).
*   **State Management:** Primarily service-based state management with RxJS `BehaviorSubject` for simple cases (e.g., `AuthService`). For more complex state, NgRx or other state management libraries could be considered.
*   **Testing:** Jasmine and Karma (for unit tests), Protractor/Cypress (for E2E tests - structure planned).

## Project Structure (`src/app/`)

*   `components/`: Contains all UI components.
    *   `login/`: Login page component.
    *   `dashboard/`: Main dashboard component for analytics.
    *   `call-logs/`: Component for displaying call logs.
    *   `call-detail/`: Component for displaying details of a single call.
    *   `feedback/`: (Placeholder) Component for feedback management.
    *   `fine-tuning/`: (Placeholder) Component for AI fine-tuning controls.
    *   `layout/`: Components for common UI elements like header, sidebar (if implemented).
*   `services/`: Contains Angular services for business logic and API communication.
    *   `auth.service.ts`: Handles authentication logic and JWT management.
    *   `call.service.ts`: Handles fetching call logs and details.
    *   `analytics.service.ts`: Handles fetching analytics data.
    *   `api.service.ts`: (Placeholder/Example) Could be a generic API handler or base service.
*   `guards/`: Route guards, primarily `auth.guard.ts` to protect routes.
*   `interceptors/`: HTTP interceptors, like `jwt.interceptor.ts` to attach JWTs to outgoing requests.
*   `shared/`: (Placeholder) For shared modules, pipes, directives, or UI models.
    *   `models/`: TypeScript interfaces for data structures (e.g., Call, Transcript, User).
*   `app.config.ts`: Application configuration, including providers for routing, HttpClient, etc.
*   `app.routes.ts`: Defines the application's routes.
*   `app.component.ts/html/scss`: The root application component.

## Setup and Running

1.  **Prerequisites:**
    *   Node.js (v18+ recommended, compatible with your Angular CLI version)
    *   NPM (or Yarn)
    *   Angular CLI installed globally: `npm install -g @angular/cli`

2.  **Installation:**
    *   Navigate to this directory: `cd frontend/ai-call-center-frontend`
    *   Install dependencies: `npm install`

3.  **Environment Configuration:**
    *   The primary backend API URL is currently hardcoded in services like `auth.service.ts` (e.g., `http://localhost:3000/api/auth`).
    *   For different environments (development, production), you should use Angular's environment files (`src/environments/environment.ts`, `src/environments/environment.prod.ts`).
    *   Update these files to point to the correct backend API URL for each environment.
        Example `src/environments/environment.prod.ts`:
        ```typescript
        export const environment = {
          production: true,
          apiUrl: 'https://yourdomain.com/api' // Your production backend API
        };
        ```
        And in services:
        ```typescript
        import { environment } from '../../../environments/environment';
        // ...
        const API_URL = `${environment.apiUrl}/auth`;
        ```

4.  **Running the Development Server:**
    *   From the `frontend/ai-call-center-frontend` directory:
        ```bash
        ng serve
        # or
        npm start
        ```
    *   The application will typically be available at `http://localhost:4200/`. The browser will auto-reload upon changes.

5.  **Building for Production:**
    *   To create a production build:
        ```bash
        ng build --configuration production
        # or
        npm run build -- --configuration production
        ```
    *   The build artifacts will be stored in the `dist/ai-call-center-frontend/browser/` directory. These are the static files to be deployed to a web server (like NGINX, which is part of the project's deployment script).

## Key Functionalities Implemented (Structurally)

*   **Authentication:**
    *   Login page (`LoginComponent`).
    *   `AuthService` for handling login/logout and token management.
    *   `AuthGuard` to protect routes.
    *   `JwtInterceptor` to attach auth tokens to API requests.
*   **Call Logging Display:**
    *   `CallLogsComponent` to list calls.
    *   `CallDetailComponent` (placeholder) to show individual call details.
    *   `CallService` to fetch call data.
*   **Dashboard:**
    *   Basic `DashboardComponent` as a landing page after login.
    *   (Analytics display to be fully implemented).

## Testing

*   Unit tests are written using Jasmine and run with Karma.
*   Test files are typically named `*.spec.ts` and are located next to the files they test.
*   To run unit tests:
    ```bash
    ng test
    # or for a single run (e.g., in CI)
    ng test --watch=false --browsers=ChromeHeadlessCI
    ```
*   E2E tests (using Protractor or Cypress) can be added for full application flow testing.

(Note: As of the current development stage, many unit tests for frontend components are deferred.)
