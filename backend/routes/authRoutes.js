const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and registration
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and get JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: securepassword123
 *     responses:
 *       200:
 *         description: Authentication successful, token and user info returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clxmg3jk0000008l3g4z3h2q1
 *                     username:
 *                       type: string
 *                       example: admin
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: admin@example.com
 *                     role:
 *                       type: string
 *                       enum: [admin, agent]
 *                       example: admin
 *       400:
 *         description: Invalid input (e.g., missing email/password, validation errors)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 errors: # If using express-validator
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid credentials (email not found)
 *       500:
 *         description: Server error
 */
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
  ],
  authController.loginUser
);

// @route   POST /api/auth/register
// @desc    Register a new user. For admin panel, this might be restricted or handled by a script.
// @access  Public (for now, can be changed to private/admin only)
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: newuser
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [admin, agent]
 *                 default: agent
 *                 example: agent
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 user:
 *                   $ref: '#/components/schemas/UserOutput' # Define UserOutput schema later
 *       400:
 *         description: Invalid input or validation error
 *       409:
 *         description: User already exists (e.g., email or username conflict)
 *       500:
 *         description: Server error
 */
router.post(
  '/register',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    body('role', 'Role must be admin or agent').optional().isIn(['admin', 'agent']),
  ],
  authController.registerUser
);

// @route   GET /api/auth/me
// @desc    Get current logged-in user's profile
// @access  Private
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current logged-in user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: [] # Indicates that this endpoint requires Bearer token authentication
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserOutput'
 *       401:
 *         description: Not authorized (token missing or invalid)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     UserOutput:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the user
 *           example: clxmg3jk0000008l3g4z3h2q1
 *         username:
 *           type: string
 *           description: Username
 *           example: testuser
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: user@example.com
 *         role:
 *           type: string
 *           enum: [admin, agent]
 *           description: User's role
 *           example: agent
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of user creation
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of last user update
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
