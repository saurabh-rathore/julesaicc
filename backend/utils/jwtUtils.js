const jwt = require('jsonwebtoken');
// console.log('INSIDE jwtUtils.js, jwt object:', jwt); // DEBUG LINE - REMOVED
require('dotenv').config(); // To access JWT_SECRET from .env

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Default to 1 hour

/**
 * Generates a JWT for a given user payload.
 * @param {Object} userPayload - The payload to include in the token (e.g., user ID, role).
 * Typically, this would be an object like { user: { id: userId, role: userRole } }.
 * @returns {string} The generated JWT.
 */
const generateToken = (userPayload) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined. Please check your .env file.');
  }
  if (!userPayload || typeof userPayload !== 'object') {
    throw new Error('Invalid userPayload for JWT generation.');
  }

  return jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verifies a JWT.
 * @param {string} token - The JWT to verify.
 * @returns {Promise<Object|null>} The decoded payload if the token is valid, otherwise null or throws error.
 */
const verifyToken = (token) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined. Please check your .env file.');
  }
  if (!token) {
    return null; // Or throw new Error('Token not provided for verification.');
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    // error could be TokenExpiredError, JsonWebTokenError, NotBeforeError
    console.error('JWT verification failed:', error.name, error.message);
    return null; // Indicate verification failure
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
