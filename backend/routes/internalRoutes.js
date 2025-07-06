const express = require('express');
const router = express.Router();
const internalController = require('../controllers/internalController');
// No JWT authMiddleware here, as these are called by AGI/Asterisk system calls.
// Security should be handled by network configuration (e.g., allow only localhost)
// or a simple shared secret if necessary.

// @route   POST /api/internal/recording-complete
// @desc    Webhook for AGI script to notify that a user utterance recording is complete
// @access  Internal (from Asterisk/AGI script)
router.post(
  '/recording-complete', // This will now be /process-utterance
  // We will change this to /process-utterance, and it will expect audioFilePath, callId, language
  internalController.recordingComplete // This controller function will be renamed/refactored
);

// @route   POST /api/internal/call-event
// @desc    Webhook for Asterisk to notify about general call events (e.g., Hangup)
// @access  Internal
router.post(
    '/call-event',
    internalController.callEvent
);

// @route   POST /api/internal/generate-tts
// @desc    Called by AGI to generate TTS audio for the AI's next prompt
// @access  Internal
router.post(
    '/generate-tts',
    // body('text').isString().notEmpty(),
    // body('callId').isString().notEmpty(),
    // body('language').isString().optional().default('en'),
    internalController.generateTtsForAgi
);

// @route   POST /api/internal/process-utterance
// @desc    Called by AGI after recording user's speech. Triggers STT, Sentiment, LLM.
// @desc    Responds with the next AI action/prompt text for AGI to handle.
// @access  Internal
router.post(
    '/process-utterance',
    // body('callId').isString().notEmpty(),
    // body('audioFilePath').isString().notEmpty(),
    // body('language').isString().optional().default('en'),
    internalController.processUtteranceForAgi
);


module.exports = router;
