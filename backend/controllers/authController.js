const userService = require('../services/userService');
const { generateToken } = require('../utils/jwtUtils');
const { validationResult } = require('express-validator');

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  // For now, basic validation. Will add express-validator rules in routes later.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await userService.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials (email not found)' });
    }

    const isMatch = await userService.validatePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials (password incorrect)' });
    }

    // User matched, create JWT payload
    const payload = {
      user: {
        id: user.id,
        role: user.role, // Include role for client-side role-based access if needed
        username: user.username
      },
    };

    const token = generateToken(payload);

    // Return user info (without password hash) and token
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    // Check if it's a known error from userService or jwtUtils, or a generic server error
    if (error.message.includes('not defined') || error.message.includes('Invalid userPayload')) {
        // Configuration error, likely JWT_SECRET
        return res.status(500).json({ message: 'Server configuration error during login.' });
    }
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Register a new user (e.g., for admin creation, could be a protected route or script-based)
// @route   POST /api/auth/register
// @access  Private (e.g., only existing admin can register new users, or script-based)
const registerUser = async (req, res) => {
  // Add express-validator checks in routes for production
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide username, email, and password' });
  }
  // Basic role validation
  if (role && !['admin', 'agent'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const newUser = await userService.createUser({ username, email, password, role });
    // Optionally, generate a token for the new user immediately if they should be logged in
    // For now, just return success and the new user data (without password)
    res.status(201).json({
      message: 'User registered successfully',
      user: newUser, // userService.createUser already returns user without password_hash
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ message: error.message }); // 409 Conflict
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
};


// @desc    Get current logged-in user's profile
// @route   GET /api/auth/me
// @access  Private (requires token)
const getMe = async (req, res) => {
    // req.user is set by the authMiddleware
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Not authorized, user data not found in token' });
    }
    try {
        const user = await userService.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user); // user object from findUserById doesn't include password_hash
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};


module.exports = {
  loginUser,
  registerUser,
  getMe,
};
