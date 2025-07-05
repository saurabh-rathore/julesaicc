const express = require('express');
const router = express.Router();
const {
  getCallStats,
  getResolutionRates,
  getFeedbackSummary,
} = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file will be protected by the authMiddleware

// @route   GET /api/analytics/stats
// @desc    Get overall call statistics (total calls, avg duration, escalations)
// @access  Private (Admin)
router.get('/stats', authMiddleware, getCallStats);

// @route   GET /api/analytics/resolution-rates
// @desc    Get AI vs Human resolution rates
// @access  Private (Admin)
router.get('/resolution-rates', authMiddleware, getResolutionRates);

// @route   GET /api/analytics/feedback-summary
// @desc    Get feedback summary (e.g., average scores)
// @access  Private (Admin)
router.get('/feedback-summary', authMiddleware, getFeedbackSummary);

module.exports = router;
