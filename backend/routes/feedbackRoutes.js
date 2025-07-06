const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file are protected by authMiddleware
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Call feedback management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Feedback:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique CUID for the feedback entry
 *           example: clxmk0abcd000008l3defg1234
 *         call_id:
 *           type: string
 *           description: ID of the call this feedback pertains to
 *           example: clxmj2q0k000008l3haefabcd
 *         rating:
 *           type: integer
 *           format: int32
 *           description: Rating given for the call (e.g., 1-5)
 *           example: 5
 *         comments:
 *           type: string
 *           nullable: true
 *           description: Textual comments for the feedback
 *           example: "Very helpful service."
 *         customer_expressed_satisfaction:
 *           type: boolean
 *           nullable: true
 *           description: Whether the customer expressed satisfaction
 *         collected_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when feedback was collected
 *     FeedbackInput:
 *       type: object
 *       required:
 *         - call_id
 *         - rating
 *       properties:
 *         call_id:
 *           type: string
 *           description: ID of the call this feedback pertains to
 *         rating:
 *           type: integer
 *           format: int32
 *           description: Rating given for the call (1-5)
 *         comments:
 *           type: string
 *           nullable: true
 *           description: Textual comments
 *         customer_expressed_satisfaction:
 *           type: boolean
 *           nullable: true
 */

// @route   POST /api/feedback
// @desc    Submit feedback for a call (creates or updates)
// @access  Private
/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit feedback for a call
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeedbackInput'
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  [
    body('call_id', 'Call ID is required').isString().notEmpty().trim().escape(),
    body('rating', 'Rating is required and must be a number between 1 and 5').isFloat({ min: 1, max: 5 }),
    body('comments').optional().isString().trim().escape(),
    body('customer_expressed_satisfaction').optional().isBoolean().toBoolean(),
  ],
  feedbackController.submitFeedback
);

// @route   GET /api/feedback/call/:callId
// @desc    Get feedback for a specific call
// @access  Private
/**
 * @swagger
 * /api/feedback/call/{callId}:
 *   get:
 *     summary: Get feedback for a specific call
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the call
 *     responses:
 *       200:
 *         description: Feedback for the specified call
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feedback not found for this call
 *       500:
 *         description: Server error
 */
router.get(
  '/call/:callId',
  [
    param('callId', 'Valid Call ID is required').isString().trim().escape(),
  ],
  feedbackController.getFeedbackForCall
);

// @route   GET /api/feedback
// @desc    Get all feedback entries (admin functionality)
// @access  Private (consider adding role-based access for admin if needed)
/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Get all feedback entries
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of all feedback entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Feedback'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  // No specific validation here, but could add pagination query params later
  feedbackController.getAllFeedbackEntries
);

module.exports = router;
