const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const callController = require('../controllers/callController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file are protected by authMiddleware
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Calls
 *   description: Call log and transcript management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Call:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique CUID for the call
 *           example: clxmj2q0k000008l3haefabcd
 *         customer_phone_number:
 *           type: string
 *           nullable: true
 *           example: "+15551234567"
 *         sip_call_id:
 *           type: string
 *           nullable: true
 *           description: SIP Call-ID from Asterisk
 *           example: "as5d8f89asdf-asd8f9asdf"
 *         start_time:
 *           type: string
 *           format: date-time
 *           description: Call start time
 *         end_time:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Call end time
 *         status:
 *           type: string
 *           enum: [initiated, ringing, answered_ai, answered_human, in_progress_ai, in_progress_human, escalated, completed, failed, missed]
 *           example: completed
 *         direction:
 *           type: string
 *           enum: [inbound, outbound]
 *           default: inbound
 *         initial_language_preference:
 *           type: string
 *           nullable: true
 *           example: "en"
 *         final_disposition:
 *           type: string
 *           nullable: true
 *           example: "resolved_by_ai"
 *         recording_url:
 *           type: string
 *           nullable: true
 *           format: url
 *         escalated_to_agent_id:
 *           type: string
 *           nullable: true
 *           description: ID of the agent if escalated
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Transcript:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           format: int64
 *         call_id:
 *           type: string
 *           example: clxmj2q0k000008l3haefabcd
 *         speaker:
 *           type: string
 *           enum: [customer, ai, human_agent]
 *         text:
 *           type: string
 *         timestamp_start:
 *           type: number
 *           format: float
 *           description: Seconds from the beginning of the call part
 *         timestamp_end:
 *           type: number
 *           format: float
 *           description: Seconds from the beginning of the call part
 *         language:
 *           type: string
 *           nullable: true
 *           example: "en"
 *         confidence_score:
 *           type: number
 *           format: float
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *     CallWithTranscripts:
 *       allOf:
 *         - $ref: '#/components/schemas/Call'
 *         - type: object
 *           properties:
 *             transcripts:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transcript'
 *     PaginatedCalls:
 *        type: object
 *        properties:
 *          calls:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/Call'
 *          pagination:
 *            type: object
 *            properties:
 *              page:
 *                type: integer
 *              limit:
 *                type: integer
 *              totalPages:
 *                type: integer
 *              totalCalls:
 *                type: integer
 */

// POST /api/calls - Create a new call log
/**
 * @swagger
 * /api/calls:
 *   post:
 *     summary: Create a new call log
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               customer_phone_number:
 *                 type: string
 *               sip_call_id:
 *                 type: string
 *               start_time:
 *                 type: string
 *                 format: date-time
 *               end_time:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [initiated, ringing, answered_ai, answered_human, in_progress_ai, in_progress_human, escalated, completed, failed, missed]
 *               direction:
 *                 type: string
 *                 enum: [inbound, outbound]
 *               initial_language_preference:
 *                 type: string
 *               final_disposition:
 *                 type: string
 *               recording_url:
 *                 type: string
 *                 format: url
 *               escalated_to_agent_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Call log created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Call'
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
    body('status', 'Status is required').notEmpty().trim().escape(),
    body('customer_phone_number').optional().trim().escape(),
    body('sip_call_id').optional().trim().escape(),
    body('direction').optional().isIn(['inbound', 'outbound']),
    // Add other validations as necessary
  ],
  callController.createCallLog
);

// GET /api/calls - Get all call logs with pagination and filtering
/**
 * @swagger
 * /api/calls:
 *   get:
 *     summary: Retrieve a list of call logs with pagination and filtering
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, ringing, answered_ai, answered_human, in_progress_ai, in_progress_human, escalated, completed, failed, missed]
 *         description: Filter by call status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date (ISO 8601)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [start_time, end_time, status, direction]
 *           default: start_time
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *     responses:
 *       200:
 *         description: A list of call logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedCalls'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
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
/**
 * @swagger
 * /api/calls/{id}:
 *   get:
 *     summary: Retrieve a single call log by ID, including transcripts
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The call ID
 *     responses:
 *       200:
 *         description: Detailed information about the call log
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CallWithTranscripts'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Call log not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  [
    param('id', 'Valid Call ID is required').isString().trim().escape(), // Assuming CUID or similar string ID
  ],
  callController.getCallLogById
);

// PUT /api/calls/:id - Update a call log
/**
 * @swagger
 * /api/calls/{id}:
 *   put:
 *     summary: Update an existing call log
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The call ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [initiated, ringing, answered_ai, answered_human, in_progress_ai, in_progress_human, escalated, completed, failed, missed]
 *               final_disposition:
 *                 type: string
 *               recording_url:
 *                 type: string
 *                 format: url
 *               # Add other updatable fields here
 *     responses:
 *       200:
 *         description: Call log updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Call'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Call log not found
 *       500:
 *         description: Server error
 */
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
/**
 * @swagger
 * /api/calls/{id}/transcripts:
 *   get:
 *     summary: Retrieve all transcripts for a specific call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The call ID
 *     responses:
 *       200:
 *         description: A list of transcripts for the call
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transcript'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Call log not found (no transcripts imply call not found or no transcripts exist)
 *       500:
 *         description: Server error
 */
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
