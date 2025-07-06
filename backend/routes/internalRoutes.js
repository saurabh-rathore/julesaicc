const express = require('express');
const router = express.Router();
const internalController = require('../controllers/internalController');
// No JWT authMiddleware here, as these are called by AGI/Asterisk system calls.
// Security should be handled by network configuration (e.g., allow only localhost)
// or a simple shared secret if necessary.

// @route   POST /api/internal/recording-complete
// @desc    Webhook for AGI script to notify that a recording is complete
// @access  Internal (from Asterisk/AGI script)
router.post(
  '/recording-complete',
  // Add minimal validation if desired, e.g., check for required body params
  // [
  //   body('callId').isString().notEmpty(),
  //   body('audioFilePath').isString().notEmpty(),
  //   body('channel').isString().notEmpty(),
  // ],
  internalController.recordingComplete
);

// @route   POST /api/internal/call-event
// @desc    Webhook for Asterisk to notify about call events (e.g., Hangup)
// @access  Internal
router.post(
    '/call-event',
    internalController.callEvent
);


module.exports = router;
