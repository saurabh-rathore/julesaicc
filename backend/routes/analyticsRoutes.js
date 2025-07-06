const express = require('express');
const router = express.Router();
const {
  getCallStats,
  getResolutionRates,
  getFeedbackSummary,
} = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file will be protected by the authMiddleware

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Endpoints for call center analytics and reporting
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CallStats:
 *       type: object
 *       properties:
 *         totalCalls:
 *           type: integer
 *           description: Total number of calls processed (excluding initial technical failures).
 *           example: 1500
 *         averageDurationSeconds:
 *           type: number
 *           format: float
 *           description: Average duration of handled calls in seconds.
 *           example: 125.5
 *         totalEscalations:
 *           type: integer
 *           description: Total number of calls escalated to human agents.
 *           example: 150
 *     ResolutionRates:
 *       type: object
 *       properties:
 *         aiResolvedCount:
 *           type: integer
 *           description: Number of calls resolved by AI.
 *           example: 800
 *         humanResolvedCount:
 *           type: integer
 *           description: Number of calls resolved by human agents after escalation.
 *           example: 120
 *         escalatedCount:
 *           type: integer
 *           description: Total number of calls that were escalated.
 *           example: 150
 *         totalRelevantCallsForResolutionRate:
 *           type: integer
 *           description: Total calls considered for calculating resolution rates (e.g., completed or escalated calls).
 *           example: 1000
 *     FeedbackSummary:
 *       type: object
 *       properties:
 *         averageRating:
 *           type: number
 *           format: float
 *           description: Average feedback rating (e.g., on a scale of 1-5).
 *           example: 4.2
 *         totalFeedbackEntries:
 *           type: integer
 *           description: Total number of feedback entries received.
 *           example: 500
 */

// @route   GET /api/analytics/stats
// @desc    Get overall call statistics (total calls, avg duration, escalations)
// @access  Private (Admin)
/**
 * @swagger
 * /api/analytics/stats:
 *   get:
 *     summary: Get overall call statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overall call statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CallStats'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats', authMiddleware, getCallStats);

// @route   GET /api/analytics/resolution-rates
// @desc    Get AI vs Human resolution rates
// @access  Private (Admin)
/**
 * @swagger
 * /api/analytics/resolution-rates:
 *   get:
 *     summary: Get AI vs Human resolution rates
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resolution rate data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResolutionRates'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/resolution-rates', authMiddleware, getResolutionRates);

// @route   GET /api/analytics/feedback-summary
// @desc    Get feedback summary (e.g., average scores)
// @access  Private (Admin)
/**
 * @swagger
 * /api/analytics/feedback-summary:
 *   get:
 *     summary: Get feedback summary
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback summary data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackSummary'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/feedback-summary', authMiddleware, getFeedbackSummary);

module.exports = router;
