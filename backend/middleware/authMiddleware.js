const { verifyToken } = require('../utils/jwtUtils');

module.exports = function(req, res, next) {
  // Get token from header
  // Common practice is to use 'Authorization' header with 'Bearer <token>'
  let token;
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7, authHeader.length); // Extract token from 'Bearer <token>'
  } else {
    // Fallback to 'x-auth-token' if 'Authorization' header is not used or not Bearer
    token = req.header('x-auth-token');
  }

  // Check if not token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token using utility
  try {
    const decodedPayload = verifyToken(token); // verifyToken from jwtUtils handles try-catch for jwt.verify

    if (!decodedPayload || !decodedPayload.user) {
      // verifyToken returns null on verification failure (expired, malformed, etc.)
      // or if payload doesn't have expected structure
      return res.status(401).json({ message: 'Token is not valid or user data missing in token' });
    }

    req.user = decodedPayload.user; // Add user from payload { id, role, username }
    next();
  } catch (error) {
    // This catch block might be redundant if verifyToken handles all its errors internally
    // and returns null. However, if verifyToken itself could throw (e.g., JWT_SECRET missing),
    // it's good to have a safety net.
    console.error('Error in auth middleware:', error.message);
    res.status(401).json({ message: 'Token is not valid (middleware error)' });
  }
};
