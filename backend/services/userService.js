const { promisePool } = require('../config/db');
const bcrypt = require('bcryptjs');
const cuid = require('cuid'); // For generating user IDs, matches schema.sql

/**
 * Creates a new user in the database.
 * @param {string} username - The username.
 * @param {string} email - The user's email.
 * @param {string} password - The user's plain text password.
 * @param {string} role - The user's role (e.g., 'admin', 'agent').
 * @returns {Promise<Object>} The created user object (excluding password) or throws an error.
 */
const createUser = async ({ username, email, password, role = 'agent' }) => {
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required');
  }

  try {
    // Check if user already exists by email or username
    let [existingUsers] = await promisePool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existingUsers.length > 0) {
      const field = existingUsers[0].email === email ? 'Email' : 'Username';
      throw new Error(`${field} already exists.`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = cuid(); // Generate a CUID for the user ID

    const newUser = {
      id: userId,
      username,
      email,
      password_hash: passwordHash,
      role,
    };

    await promisePool.query('INSERT INTO users SET ?', newUser);

    // Return user object without password_hash for security
    const { password_hash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error creating user:', error.message);
    throw error; // Re-throw to be handled by controller
  }
};

/**
 * Finds a user by their email address.
 * @param {string} email - The email address to search for.
 * @returns {Promise<Object|null>} The user object if found (including password_hash), otherwise null.
 */
const findUserByEmail = async (email) => {
  if (!email) {
    throw new Error('Email is required to find a user.');
  }
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding user by email:', error.message);
    throw error;
  }
};

/**
 * Finds a user by their ID.
 * @param {string} id - The user ID to search for.
 * @returns {Promise<Object|null>} The user object if found (excluding password_hash), otherwise null.
 */
const findUserById = async (id) => {
  if (!id) {
    throw new Error('User ID is required.');
  }
  try {
    const [rows] = await promisePool.query(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding user by ID:', error.message);
    throw error;
  }
};

/**
 * Validates a user's password.
 * @param {string} inputPassword - The plain text password to validate.
 * @param {string} hashedPassword - The stored hashed password.
 * @returns {Promise<boolean>} True if the password matches, false otherwise.
 */
const validatePassword = async (inputPassword, hashedPassword) => {
  if (!inputPassword || !hashedPassword) {
    return false; // Or throw error, but for validation, returning false is common
  }
  try {
    return await bcrypt.compare(inputPassword, hashedPassword);
  } catch (error) {
    console.error('Error validating password:', error.message);
    // Should not happen with bcrypt.compare unless inputs are wildly wrong type
    return false;
  }
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  validatePassword,
};
