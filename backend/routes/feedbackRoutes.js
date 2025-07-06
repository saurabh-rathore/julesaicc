const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file are protected by authMiddleware
router.use(authMiddleware);

// @route   POST /api/feedback
// @desc    Submit feedback for a call (creates or updates)
// @access  Private
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
router.get(
  '/',
  // No specific validation here, but could add pagination query params later
  feedbackController.getAllFeedbackEntries
);

module.exports = router;
