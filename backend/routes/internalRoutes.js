const express = require('express');
const router = express.Router();
const internalController = require('../controllers/internalController');
// No JWT authMiddleware here, as these are called by AGI/Asterisk system calls.
// Security should be handled by network configuration (e.g., allow only localhost)
// or a simple shared secret if necessary.

const { body, query } = require('express-validator'); // Added query for GET endpoint

/**
 * @swagger
 * tags:
 *   name: InternalAPI
 *   description: Internal APIs for AGI script and Asterisk interaction. Not for public use.
 */

// Note: The '/recording-complete' route is now effectively replaced by '/process-utterance'.
// We can remove it or keep it commented if there's a chance of needing it for a different flow.
// For now, let's comment it out to avoid confusion.
/*
// @route   POST /api/internal/recording-complete
// @desc    Webhook for AGI script to notify that a user utterance recording is complete
// @access  Internal (from Asterisk/AGI script)
router.post(
  '/recording-complete',
  internalController.recordingComplete
);
*/

// @route   POST /api/internal/call-event
// @desc    Webhook for Asterisk to notify about general call events (e.g., Hangup)
// @access  Internal ( zabezpieczyć np. przez sprawdzanie adresu IP serwera Asteriska )
/**
 * @swagger
 * /api/internal/call-event:
 *   post:
 *     summary: Receives call events from Asterisk (e.g., Hangup)
 *     tags: [InternalAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json: # AGI script uses x-www-form-urlencoded, ensure controller handles this or change AGI
 *           schema:
 *             type: object
 *             properties:
 *               callId:
 *                 type: string
 *               channel:
 *                 type: string
 *               event:
 *                 type: string
 *                 example: hangup
 *               cause:
 *                 type: string
 *                 description: Hangup cause code
 *     responses:
 *       200:
 *         description: Event received
 *       400:
 *         description: Bad request (e.g., missing parameters)
 */
router.post(
    '/call-event',
    [ // Adding basic validation
        body('callId').isString().notEmpty(),
        body('event').isString().notEmpty(),
        body('channel').optional().isString(),
        body('cause').optional().isString(),
    ],
    internalController.callEvent
);

// @route   POST /api/internal/generate-tts
// @desc    Called by AGI to generate TTS audio for the AI's next prompt
// @access  Internal
/**
 * @swagger
 * /api/internal/generate-tts:
 *   post:
 *     summary: Generates TTS audio from text and returns the file path
 *     tags: [InternalAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - callId
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to synthesize
 *               callId:
 *                 type: string
 *                 description: Call ID for naming/logging
 *               language:
 *                 type: string
 *                 default: "en"
 *               speakerId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: TTS audio file path
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 audioFilePath:
 *                   type: string
 *       400:
 *         description: Bad request (e.g., missing parameters)
 *       500:
 *         description: Server error during TTS generation
 */
router.post(
    '/generate-tts',
    [
        body('text').isString().notEmpty(),
        body('callId').isString().notEmpty(),
        body('language').optional().isString(),
        body('speakerId').optional({ nullable: true }).isString(),
    ],
    internalController.generateTtsForAgi
);

// @route   POST /api/internal/process-utterance
// @desc    Called by AGI after recording user's speech. Triggers STT, Sentiment, LLM.
// @desc    Responds with the next AI action/prompt text for AGI to handle.
// @access  Internal
/**
 * @swagger
 * /api/internal/process-utterance:
 *   post:
 *     summary: Processes recorded user utterance and returns next AI action
 *     tags: [InternalAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json: # AGI script currently sends x-www-form-urlencoded, need to align or handle in controller
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *               - audioFilePath
 *             properties:
 *               callId:
 *                 type: string
 *               audioFilePath:
 *                 type: string
 *               language:
 *                 type: string
 *                 default: "en"
 *               channel:
 *                 type: string
 *                 description: Asterisk channel name
 *               recordingTerminationReason:
 *                  type: string
 *                  description: Reason why recording stopped (timeout, silence, dtmf, hangup)
 *               dtmfDigit:
 *                  type: string
 *                  nullable: true
 *                  description: DTMF digit if recording was stopped by it
 *     responses:
 *       200:
 *         description: Next AI action
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 action:
 *                   type: string
 *                   enum: [speak_and_record, speak_and_hangup, record, escalate, hangup, error]
 *                 text:
 *                   type: string
 *                   nullable: true
 *                   description: Text for AI to speak (if action is speak_*)
 *                 reason:
 *                   type: string
 *                   nullable: true
 *                   description: Reason for hangup/escalation
 *                 text_to_speak_before_escalate:
 *                    type: string
 *                    nullable: true
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post(
    '/process-utterance',
    [
        body('callId').isString().notEmpty(),
        body('audioFilePath').isString().notEmpty(), // Could be null if recording failed, controller should handle
        body('language').optional().isString(),
        body('channel').optional().isString(),
        body('recordingTerminationReason').optional().isString(),
        body('dtmfDigit').optional({ nullable: true }).isString(),
    ],
    internalController.processUtteranceForAgi
);

// @route   GET /api/internal/ai-next-action
// @desc    Called by AGI to determine the AI's initial or next prompt before recording.
// @access  Internal
/**
 * @swagger
 * /api/internal/ai-next-action:
 *   get:
 *     summary: Gets the next action/prompt for the AI to deliver via AGI
 *     tags: [InternalAPI]
 *     parameters:
 *       - in: query
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the call
 *       - in: query
 *         name: channel
 *         required: true
 *         schema:
 *           type: string
 *         description: The Asterisk channel name
 *     responses:
 *       200:
 *         description: AI action (e.g., text to speak, instruction to record)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 action:
 *                   type: string
 *                   enum: [speak_and_record, record, hangup, escalate]
 *                 text:
 *                   type: string
 *                   nullable: true
 *                   description: Text for AI to speak (if action is speak_and_record)
 *                 reason:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Bad request (missing parameters)
 *       404:
 *         description: Call not found or no action determined
 *       500:
 *         description: Server error
 */
router.get(
    '/ai-next-action',
    [
        query('callId').isString().notEmpty(),
        query('channel').isString().notEmpty(),
    ],
    internalController.getNextAiActionForAgi
);


module.exports = router;
