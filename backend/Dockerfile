# Dockerfile for the AI Call Center Backend

# --- Stage 1: Build Stage ---
# This stage installs dependencies and builds the application.
FROM node:18-slim AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install only production dependencies to keep the image lean
RUN npm install --omit=dev

# Copy the rest of the application source code
COPY . .

# --- Stage 2: Production Stage ---
# This stage creates the final, lean image to run the application.
FROM node:18-slim

# Set the working directory
WORKDIR /app

# Copy the pre-installed node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the application code from the builder stage
COPY --from=builder /app .

# The backend application requires a .env file for configuration.
# This file should be provided to the container at runtime.
# Example: docker run -v /path/to/your/.env:/app/.env ...

# Expose the port the application will run on
EXPOSE 3000

# The command to start the application
CMD ["node", "index.js"]
