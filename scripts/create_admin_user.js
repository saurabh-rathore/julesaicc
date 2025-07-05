#!/usr/bin/env node
// This script is used to create an initial admin user for the application.
// Usage: node scripts/create_admin_user.js <username> <email> <password>
// Example: node scripts/create_admin_user.js admin admin@example.com securepassword123

// Need to adjust path to access backend services and config
// This assumes the script is run from the project root directory.
require('dotenv').config({ path: './backend/.env' }); // Load .env from backend
const userService = require('../backend/services/userService');
const { promisePool } = require('../backend/config/db'); // Required for userService to work

const createAdmin = async () => {
  const args = process.argv.slice(2); // Remove 'node' and script path

  if (args.length < 3) {
    console.error('Usage: node scripts/create_admin_user.js <username> <email> <password>');
    process.exit(1);
  }

  const [username, email, password] = args;
  const role = 'admin'; // Forcibly set role to admin

  console.log(`Attempting to create admin user: ${username} (${email})`);

  try {
    // Check if the database connection is available
    // A simple query to test connection before calling userService
    await promisePool.query('SELECT 1');
    console.log('Database connection successful.');

    const newUser = await userService.createUser({
      username,
      email,
      password,
      role,
    });
    console.log('Admin user created successfully!');
    console.log('User ID:', newUser.id);
    console.log('Username:', newUser.username);
    console.log('Email:', newUser.email);
    console.log('Role:', newUser.role);
  } catch (error) {
    console.error('Failed to create admin user:');
    console.error(error.message);
    if (error.sqlMessage) { // More specific DB errors
        console.error('DB Error:', error.sqlMessage);
    }
    process.exit(1);
  } finally {
    // Close the database connection pool
    // Important: This will prevent the script from hanging if successful or if userService fails early.
    // However, if other async operations were intended after this, this might be too soon.
    // For this script, it's likely the last DB operation.
    await promisePool.end();
    console.log('Database connection closed.');
  }
};

// Execute the function
createAdmin();
