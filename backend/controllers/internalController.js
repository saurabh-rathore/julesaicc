const aiCallHandlerService = require('../services/aiCallHandlerService');
const callService = require('../services/callService'); // For updating call status on hangup

// @desc    Handle notification from AGI script that recording is complete
// @route   POST /api/internal/recording-complete
// @access  Restricted (e.g., localhost or specific IPs)
const recordingComplete = async (req, res) => {
  const { callId, audioFilePath, channel, language } = req.body;

  if (!callId || !audioFilePath || !channel) {
    console.error('InternalController: Missing callId, audioFilePath, or channel in recording-complete notification.');
    return res.status(400).json({ message: 'Missing required parameters.' });
  }

  console.log(`InternalController: Received recording-complete for callId: ${callId}, file: ${audioFilePath}, channel: ${channel}`);

  try {
    // Trigger the next step in the AI call handling process
    // This was previously part of processNextAiTurn, now split
    // The aiCallHandlerService.handleCustomerSpeech was a placeholder, let's adapt it
    // to a more generic "processRecordedAudio" or similar.
    // For now, let's assume aiCallHandlerService.handleCustomerSpeech can be called here.
    // Renamed to processRecordedAudio in aiCallHandlerService

    // The AGI script should pass callId, audioFilePath, and language.
    // Channel might also be useful for verification but callId is key.

    aiCallHandlerService.processRecordedAudio(callId, audioFilePath, language)
      .then(() => {
        console.log(`InternalController: Successfully initiated processing for recorded audio ${audioFilePath} for call ${callId}`);
      })
      .catch(error => {
        console.error(`InternalController: Error triggering speech processing for ${callId}:`, error);
        // Error is already handled within handleCustomerSpeech/handleAiTurnError,
        // which might try to play an error message or escalate.
      });

    // Respond quickly to AGI, don't wait for full processing.
    res.status(200).json({ message: 'Recording notification received, processing initiated.' });

  } catch (error) {
    console.error('InternalController: Error in recording-complete handler:', error);
    res.status(500).json({ message: 'Server error processing recording completion.' });
  }
};


// @desc    Handle call event notifications from Asterisk (e.g., Hangup)
// @route   POST /api/internal/call-event
// @access  Restricted
const callEvent = async (req, res) => {
    const { callId, channel, event, cause } = req.body; // 'cause' for hangup

    if (!callId || !event) {
        console.error('InternalController: Missing callId or event type in call-event notification.');
        return res.status(400).json({ message: 'Missing callId or event type.' });
    }

    console.log(`InternalController: Received call event: ${event} for callId: ${callId}, channel: ${channel}, cause: ${cause}`);

    try {
        if (event.toLowerCase() === 'hangup') {
            // Get hangup cause description if needed
            // const hangupCauseText = getHangupCauseText(cause); // You'd need a mapping for this
            await aiCallHandlerService.endAiCall(callId, `hangups_cause_${cause || 'unknown'}`);
        }
        // Handle other events if necessary (e.g., DTMF, specific errors)

        res.status(200).json({ message: 'Call event received and processed.' });
    } catch (error) {
        console.error(`InternalController: Error processing call event for callId ${callId}:`, error);
        res.status(500).json({ message: 'Server error processing call event.' });
    }
};


module.exports = {
  recordingComplete,
  callEvent,
};
