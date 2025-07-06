const aiCallHandlerService = require('../services/aiCallHandlerService');
const callService = require('../services/callService'); // For updating call status on hangup
const ttsService = require('../services/ttsService'); // For generateTtsForAgi

// @desc    Called by AGI after recording user's speech. Triggers STT, Sentiment, LLM.
// @desc    Responds with the next AI action/prompt text for AGI to handle.
// @route   POST /api/internal/process-utterance
// @access  Restricted (e.g., localhost or specific IPs)
const processUtteranceForAgi = async (req, res) => {
  const { callId, audioFilePath, language, channel } = req.body;

  if (!callId || !audioFilePath) {
    console.error('InternalController: Missing callId or audioFilePath in process-utterance notification.');
    return res.status(400).json({ action: 'error', message: 'Missing callId or audioFilePath.' });
  }

  console.log(`InternalController: Received /process-utterance for callId: ${callId}, file: ${audioFilePath}, lang: ${language}, channel: ${channel}`);

  try {
    // aiCallHandlerService.processRecordedAudio was the old name
    // It should now be something like:
    const aiActionResponse = await aiCallHandlerService.handleRecordedUtterance(callId, audioFilePath, language, channel);

    console.log(`InternalController: Sending action to AGI for call ${callId}:`, JSON.stringify(aiActionResponse));
    res.status(200).json(aiActionResponse);
  } catch (error) {
    console.error(`InternalController: Error in process-utterance handler for call ${callId}:`, error);
    res.status(500).json({ action: 'error', message: 'Server error processing utterance.' });
  }
};

// @desc    Called by AGI to request the next action/prompt from the AI.
// @route   GET /api/internal/ai-next-action
// @access  Restricted
const getNextAiActionForAgi = async (req, res) => {
    const { callId, channel } = req.query;
    if (!callId || !channel) {
        console.error('InternalController: Missing callId or channel for getNextAiAction.');
        return res.status(400).json({ action: 'error', message: 'Missing callId or channel.' });
    }
    console.log(`InternalController: Received /ai-next-action for callId: ${callId}, channel: ${channel}`);
    try {
        const action = await aiCallHandlerService.determineNextAiAction(callId, channel);
        res.status(200).json(action);
    } catch (error) {
        console.error(`InternalController: Error in getNextAiAction for call ${callId}:`, error);
        res.status(500).json({ action: 'error', message: 'Server error determining next AI action.' });
    }
};


// @desc    Called by AGI to generate TTS audio for a given text.
// @route   POST /api/internal/generate-tts
// @access  Restricted
const generateTtsForAgi = async (req, res) => {
  const { text, callId, language = 'en', speakerId = null } = req.body;

  if (!text || !callId) {
    console.error('InternalController: Missing text or callId for TTS generation.');
    return res.status(400).json({ error: 'Missing text or callId for TTS.' });
  }

  try {
    const audioFilePath = await ttsService.textToSpeech(text, callId, language, speakerId);
    console.log(`InternalController: TTS audio generated for call ${callId} at ${audioFilePath}`);
    res.status(200).json({ audioFilePath });
  } catch (error) {
    console.error(`InternalController: Error generating TTS for call ${callId}:`, error);
    res.status(500).json({ error: 'Server error generating TTS audio.' });
  }
};


// @desc    Handle call event notifications from Asterisk (e.g., Hangup via 'h' extension)
// @route   POST /api/internal/call-event
// @access  Restricted
const callEvent = async (req, res) => {
    const { callId, channel, event, cause } = req.body;

    if (!callId || !event) {
        console.error('InternalController: Missing callId or event type in call-event notification.');
        return res.status(400).json({ message: 'Missing callId or event type.' });
    }

    console.log(`InternalController: Received call event: ${event} for callId: ${callId}, channel: ${channel}, cause: ${cause}`);

    try {
        if (event.toLowerCase() === 'hangup') {
            await aiCallHandlerService.endAiCall(callId, `hangup_event_cause_${cause || 'unknown'}`, channel);
        }
        res.status(200).json({ message: 'Call event received.' });
    } catch (error) {
        console.error(`InternalController: Error processing call event for callId ${callId}:`, error);
        res.status(500).json({ message: 'Server error processing call event.' });
    }
};


module.exports = {
  processUtteranceForAgi, // Renamed from recordingComplete
  generateTtsForAgi,
  getNextAiActionForAgi,
  callEvent,
};
