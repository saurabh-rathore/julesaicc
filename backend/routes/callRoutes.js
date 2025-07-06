const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const callController = require('../controllers/callController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file are protected by authMiddleware
router.use(authMiddleware);

// POST /api/calls - Create a new call log
router.post(
  '/',
  [
    body('status', 'Status is required').notEmpty().trim().escape(),
    body('customer_phone_number').optional().trim().escape(),
    body('sip_call_id').optional().trim().escape(),
    body('direction').optional().isIn(['inbound', 'outbound']),
    // Add other validations as necessary
  ],
  callController.createCallLog
);

// GET /api/calls - Get all call logs with pagination and filtering
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().trim().escape(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('sortBy').optional().trim().escape().isIn(['start_time', 'end_time', 'status', 'direction']),
    query('order').optional().trim().escape().toUpperCase().isIn(['ASC', 'DESC']),
  ],
  callController.getCallLogs
);

// GET /api/calls/:id - Get a single call log by ID
router.get(
  '/:id',
  [
    param('id', 'Valid Call ID is required').isString().trim().escape(), // Assuming CUID or similar string ID
  ],
  callController.getCallLogById
);

// PUT /api/calls/:id - Update a call log
router.put(
  '/:id',
  [
    param('id', 'Valid Call ID is required').isString().trim().escape(),
    body('status').optional().trim().escape(),
    body('final_disposition').optional().trim().escape(),
    // Add other updatable fields and their validations
  ],
  callController.updateCallLog
);

// GET /api/calls/:id/transcripts - Get transcripts for a specific call
router.get(
  '/:id/transcripts',
  [
    param('id', 'Valid Call ID is required').isString().trim().escape(),
  ],
  callController.getCallTranscripts
);

// Placeholder for incoming call webhook (might need different auth or be public depending on source)
// For now, keeping it under authMiddleware, but this might change.
// router.post('/incoming', (req, res) => {
//   res.status(501).json({ message: 'Incoming call webhook not implemented yet.' });
// });

// Placeholder for submitting feedback for a call (might move to a feedbackRoute.js)
// router.post('/:callId/feedback', (req, res) => {
//   const { callId } = req.params;
//   res.status(501).json({ message: `Submit feedback for call ${callId} not implemented yet.` });
// });

module.exports = router;
