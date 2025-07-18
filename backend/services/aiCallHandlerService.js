const fs = require('fs').promises;
const amiService = require('./amiService');
const sttService = require('./sttService');
const llmService = require('./llmService');
const ttsService = require('./ttsService');
const callService = require('./callService');
const customerPlanService = require('./customerPlanService');
const sentimentAnalysisService = require('./sentimentAnalysisService');
const redis = require('redis');

const redisClient = redis.createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

const activeAICalls = {
  get: async (callId) => {
    const callData = await redisClient.get(callId);
    return callData ? JSON.parse(callData) : null;
  },
  set: async (callId, callData) => {
    await redisClient.set(callId, JSON.stringify(callData), {
      EX: 3600 // Expire in 1 hour
    });
  },
  delete: async (callId) => {
    await redisClient.del(callId);
  },
  has: async (callId) => {
    const result = await redisClient.exists(callId);
    return result === 1;
  }
};

const CALL_STATE = {
  NEW: 'NEW', // Call object created, pre-greeting
  GREETING_SENT: 'GREETING_SENT', // Initial greeting TTS sent to AGI for playback
  AWAITING_USER_UTTERANCE: 'AWAITING_USER_UTTERANCE', // AGI is currently recording user
  PROCESSING_UTTERANCE: 'PROCESSING_UTTERANCE', // Backend is doing STT, Sentiment, LLM
  READY_TO_SPEAK: 'READY_TO_SPEAK', // Backend has AI response, AGI should fetch and play it
  ESCALATING: 'ESCALATING', // Escalation process initiated
  ENDED: 'ENDED',       // Call processing by AI has finished
};

function updateCallState(callId, newState) {
  const callData = activeAICalls.get(callId);
  if (callData) {
    console.log(`AI Call Handler: [${callId}] State transition: ${callData.state} -> ${newState}`);
    callData.state = newState;
    callData.lastActivityTime = Date.now();
  } else {
    console.warn(`AI Call Handler: Attempted to update state for non-existent or ended call ${callId} to ${newState}`);
  }
}

/**
 * Initializes an AI call when a new channel arrives.
 * Called from index.js upon relevant AMI NewChannel event.
 * This version primarily sets up the call in activeAICalls. The actual greeting
 * will be fetched by the AGI script via determineNextAiAction.
 */
async function startAiCall(callId, channel, callerIdNum, language = 'en') {
  console.log(`AI Call Handler: [${callId}] Initializing AI call. Channel: ${channel}, Caller: ${callerIdNum}, Lang: ${language}`);
  if (activeAICalls.has(callId)) {
    console.warn(`AI Call Handler: [${callId}] Call is already being handled.`);
    return;
  }

  activeAICalls.set(callId, {
    callId,
    channel,
    callerIdNum,
    language,
    state: CALL_STATE.NEW, // Initial state
    history: [],
    errorCount: 0,
    lastActivityTime: Date.now(),
  });

  try {
    await callService.updateCall(callId, { status: 'answered_ai', initial_language_preference: language });

    // Set AI_CALL_ACTIVE=true for the dialplan loop
    await amiService.sendAction({
      action: 'SetVar',
      channel: channel,
      variable: 'AI_CALL_ACTIVE',
      value: 'true',
    });
    console.log(`AI Call Handler: [${callId}] Set AI_CALL_ACTIVE=true. Ready for AGI to take over.`);
    // The first action AGI will take is to call /api/internal/ai-next-action
    updateCallState(callId, CALL_STATE.GREETING_SENT); // Indicates greeting is the next expected AI speech

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error in startAiCall:`, error);
    await endAiCall(callId, 'error_setup', channel);
  }
}

/**
 * Called by AGI script (via internal controller) to get the AI's next action.
 * This could be text to speak, or instructions to hangup/escalate.
 */
async function determineNextAiAction(callId, channel) {
  const callData = activeAICalls.get(callId);
  if (!callData) {
    console.warn(`AI Call Handler: [${callId}] determineNextAiAction called for inactive/unknown call.`);
    return { action: 'hangup', reason: 'call_not_found_or_ended' };
  }

  if (callData.channel !== channel) {
    console.warn(`AI Call Handler: [${callId}] Channel mismatch in determineNextAiAction. Stored: ${callData.channel}, AGI: ${channel}. Ending call.`);
    await endAiCall(callId, 'error_channel_mismatch', callData.channel);
    return { action: 'hangup', reason: 'channel_mismatch' };
  }

  console.log(`AI Call Handler: [${callId}] AGI requesting next action. Current state: ${callData.state}`);
  updateCallState(callId, CALL_STATE.AWAITING_USER_UTTERANCE); // AGI will now play prompt then record

  if (callData.history.length === 0) { // First interaction after setup
    const greetingText = process.env.GREETING_MESSAGE || "Hello! Thank you for calling. How can I help you today?";
    // Log this greeting as if AI spoke it, for history
    await callService.createTranscript({ call_id: callId, speaker: 'ai', text: greetingText, language: callData.language, timestamp_start:0, timestamp_end:0 });
    callData.history.push({ speaker: 'ai', text: greetingText, language: callData.language });
    return { action: 'speak_and_record', text: greetingText };
  }

  // For subsequent turns, processUtteranceForAgi would have returned the text.
  // This endpoint is primarily for the AGI to *initiate* a turn by getting what to say.
  // If the AI just spoke (via processUtteranceForAgi returning 'speak'), AGI should now record.
  // This logic might need refinement based on how AGI loop is structured.
  // For now, if not first turn, assume AGI should just record.
  return { action: 'record' }; // Instructs AGI to record user input
}

/**
 * Called by AGI script (via internal controller) after an utterance is recorded.
 * Processes the audio, queries LLM, and returns the next AI action/text.
 */
async function handleRecordedUtterance(callId, audioFilePath, agiLanguage, channel) {
  const callData = activeAICalls.get(callId);

  if (!callData || callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) {
    console.warn(`AI Call Handler: [${callId}] Received recording for an inactive/ended/escalating call. Path: ${audioFilePath}`);
    if (audioFilePath) { try { await fs.unlink(audioFilePath); } catch (e) { /* ignore */ } }
    return { action: 'hangup', reason: 'call_inactive_on_recording_receipt' };
  }
  if (channel && callData.channel !== channel) {
     console.warn(`AI Call Handler: [${callId}] Channel mismatch in handleRecordedUtterance. Stored: ${callData.channel}, AGI: ${channel}. Ending call.`);
     await endAiCall(callId, 'error_channel_mismatch_on_utterance', callData.channel);
     return { action: 'hangup', reason: 'channel_mismatch_on_utterance' };
  }

  callData.language = agiLanguage || callData.language;
  updateCallState(callId, CALL_STATE.PROCESSING_UTTERANCE);
  console.log(`AI Call Handler: [${callId}] Processing recorded audio: ${audioFilePath} for lang: ${callData.language}`);

  try {
    const transcriptionResult = await sttService.transcribeAudio(audioFilePath, callData.language);
    const customerText = transcriptionResult.text ? transcriptionResult.text.trim() : "";
    const sttLanguage = transcriptionResult.language || callData.language;
    console.log(`AI Call Handler: [${callId}] STT Result (lang: ${sttLanguage}): "${customerText}"`);

    if (audioFilePath) { try { await fs.unlink(audioFilePath); } catch (e) { console.error(`AI Call Handler: [${callId}] Error deleting temp recording ${audioFilePath}:`, e);}}

    if (!customerText) {
      console.log(`AI Call Handler: [${callId}] Empty transcription.`);
      callData.errorCount = (callData.errorCount || 0) + 1;
      if (callData.errorCount > 2) { // Allow one retry for empty input
        await endAiCall(callId, 'error_no_input_max_retries', callData.channel);
        return { action: 'speak_and_hangup', text: process.env.ERROR_MESSAGE_TTS || "Sorry, I'm having trouble understanding. Please call back." };
      }
      updateCallState(callId, CALL_STATE.AWAITING_USER_UTTERANCE);
      const noUnderstandMsg = process.env.DID_NOT_UNDERSTAND_MESSAGE || "Sorry, I didn't catch that. Could you please repeat?";
      await callService.createTranscript({ call_id: callId, speaker: 'ai', text: noUnderstandMsg, language: callData.language, timestamp_start:0, timestamp_end:0 });
      callData.history.push({ speaker: 'ai', text: noUnderstandMsg, language: callData.language });
      return { action: 'speak_and_record', text: noUnderstandMsg };
    }
    callData.errorCount = 0;

    await callService.createTranscript({
      call_id: callId, speaker: 'customer', text: customerText,
      timestamp_start: transcriptionResult.timestamp_start || 0,
      timestamp_end: transcriptionResult.timestamp_end || 0,
      language: sttLanguage,
    });
    callData.history.push({ speaker: 'customer', text: customerText, language: sttLanguage });

    const sentimentResult = await sentimentAnalysisService.analyzeSentiment(customerText);
    if (sentimentResult && typeof sentimentResult.score === 'number') {
      console.log(`AI Call Handler: [${callId}] Sentiment Score: ${sentimentResult.score}`);
      const sentimentEscalationThreshold = parseInt(process.env.SENTIMENT_ESCALATION_THRESHOLD || "-2");
      if (sentimentResult.score < sentimentEscalationThreshold && !sentimentResult.error) {
        console.log(`AI Call Handler: [${callId}] Negative sentiment. Escalating.`);
        // Escalation logic will be handled by AGI based on this response
        const escalationReason = `escalation_due_to_negative_sentiment (score: ${sentimentResult.score})`;
        await callService.updateCall(callId, { status: 'escalating', final_disposition: escalationReason }); // Update DB
        updateCallState(callId, CALL_STATE.ESCALATING); // Update local state
        activeAICalls.delete(callId); // Remove from active AI handling
         return { action: 'escalate', reason: escalationReason, text_to_speak_before_escalate: "Please wait while I transfer you to a human agent." };
      }
    }

    let systemPrompt = `You are a helpful AI assistant for a telecom company. The customer is speaking ${sttLanguage}.`;
    try {
      const plan = await customerPlanService.findCustomerPlanByIdentifier(callData.callerIdNum);
      if (plan) systemPrompt += ` Customer plan: ${plan.plan_name}, details: ${JSON.stringify(plan.plan_details)}.`;
    } catch (planError) { console.error(`AI Call Handler: [${callId}] Error fetching customer plan: ${planError.message}`); }

    // Advanced context: last 3 turns + summary of earlier turns
    const recentHistory = callData.history.slice(-6); // Last 3 user/AI pairs
    const olderHistory = callData.history.slice(0, -6);
    if (olderHistory.length > 0) {
        const summary = await llmService.summarizeHistory(olderHistory);
        systemPrompt += `\nSummary of earlier conversation: ${summary}`;
    }

    const llmResponseText = await llmService.queryLLM(
      customerText, callId, callData.callerIdNum,
      { system: systemPrompt, conversation_history: recentHistory }
    );
    // llmService logs its own transcript as 'ai'
    callData.history.push({ speaker: 'ai', text: llmResponseText, language: callData.language });

    if (llmResponseText.toLowerCase().includes("transfer to agent") || llmResponseText.toLowerCase().includes("speak to a representative")) {
      await escalateCall(callId, "llm_request_escalation_keyword"); // This updates DB and activeAICalls
      return { action: 'escalate', reason: 'llm_request_escalation_keyword', text_to_speak_before_escalate: llmResponseText };
    } else if (llmResponseText.toLowerCase().includes("goodbye") || llmResponseText.toLowerCase().includes("thank you for calling")) {
      await endAiCall(callId, "completed_by_ai", callData.channel);
      return { action: 'speak_and_hangup', text: llmResponseText };
    } else {
      updateCallState(callId, CALL_STATE.AWAITING_USER_UTTERANCE);
      return { action: 'speak_and_record', text: llmResponseText };
    }

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error in handleRecordedUtterance:`, error);
    callData.errorCount = (callData.errorCount || 0) + 1;
    const defaultErrorMsg = process.env.ERROR_MESSAGE_TTS || "I'm having trouble processing your request. Please try again.";
    if (callData.errorCount > 1) {
        await endAiCall(callId, 'error_processing_max_retries', callData.channel);
        return { action: 'speak_and_hangup', text: defaultErrorMsg };
    }
    updateCallState(callId, CALL_STATE.AWAITING_USER_UTTERANCE);
    return { action: 'speak_and_record', text: defaultErrorMsg };
  }
}


async function endAiCall(callId, disposition = 'completed', channel = null) {
  const callData = activeAICalls.get(callId);
  const currentChannel = callData ? callData.channel : channel;

  if (!callData && !currentChannel) {
    console.log(`AI Call Handler: Cannot end call ${callId}. No active call data and no channel provided.`);
    return;
  }

  if (callData && callData.state === CALL_STATE.ENDED) {
    console.log(`AI Call Handler: [${callId}] Call already marked as ENDED.`);
    return;
  }

  if (callData) {
    console.log(`AI Call Handler: [${callId}] Ending call with disposition: ${disposition}. Current state: ${callData.state}`);
    updateCallState(callId, CALL_STATE.ENDED);
  } else {
    console.log(`AI Call Handler: [${callId}] Ending call (no active data) with disposition: ${disposition}. Channel: ${currentChannel}`);
  }

  try {
    if (currentChannel) {
        await amiService.sendAction({
            action: 'SetVar', channel: currentChannel, variable: 'AI_CALL_ACTIVE', value: 'false'
        }).catch(err => console.error(`AI Call Handler: [${callId}] Error setting AI_CALL_ACTIVE=false:`, err));
    }

    const dbStatus = disposition.startsWith('error') ? 'failed' :
                     disposition.startsWith('completed') ? 'completed' :
                     disposition;

    const existingCall = await callService.getCallById(callId);
    if (existingCall) {
        if (!['completed', 'failed', 'escalated'].includes(existingCall.status)) {
            await callService.updateCall(callId, {
              status: dbStatus, end_time: new Date(), final_disposition: disposition,
            });
            console.log(`AI Call Handler: [${callId}] Call log updated. Status: ${dbStatus}, Disposition: ${disposition}`);
        } else {
            console.log(`AI Call Handler: [${callId}] Call log already in a final state (${existingCall.status}). Not updating.`);
        }
    } else {
        console.warn(`AI Call Handler: [${callId}] No call record found in DB to update for disposition ${disposition}.`);
    }

    // AGI script should handle hangup if it receives { action: 'hangup' } or { action: 'speak_and_hangup' }
    // Backend should only issue Hangup via AMI if it's an emergency stop or specific cases not covered by AGI's natural termination.
    // Example: if 'error_setup' or 'error_max_retries' and AGI might not be in control.
    if (currentChannel && (disposition === 'error_setup' || disposition === 'error_max_retries')) {
        if (!callData || callData.state !== CALL_STATE.ESCALATING) {
            console.log(`AI Call Handler: [${callId}] AI ending call directly. Issuing Hangup for channel ${currentChannel}`);
            await amiService.sendAction({ action: 'Hangup', channel: currentChannel })
                .catch(err => console.error(`AI Call Handler: [${callId}] Error sending Hangup command:`, err));
        }
    }
  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error during call cleanup:`, error);
  } finally {
    if (activeAICalls.has(callId)) {
        activeAICalls.delete(callId);
        console.log(`AI Call Handler: [${callId}] Removed from active AI calls. Total active: ${activeAICalls.size}`);
    }
  }
}

async function escalateCall(callId, reason = 'escalated_by_ai') {
  const callData = activeAICalls.get(callId);
  if (!callData || callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) {
    console.warn(`AI Call Handler: [${callId}] Call already ended, escalating, or not found. Cannot escalate.`);
    return; // AGI will get a hangup or noop if this path is hit after action already decided
  }

  console.log(`AI Call Handler: [${callId}] Preparing to escalate call. Reason: ${reason}`);
  updateCallState(callId, CALL_STATE.ESCALATING); // Set state before async ops

  try {
    await callService.updateCall(callId, {
      status: 'escalating',
      final_disposition: reason,
    });
    console.log(`AI Call Handler: [${callId}] Call status updated to 'escalating'. AGI should handle transfer.`);

    // Set AI_CALL_ACTIVE to false so dialplan loop terminates after AGI handles the escalate action
    await amiService.sendAction({
        action: 'SetVar',
        channel: callData.channel,
        variable: 'AI_CALL_ACTIVE',
        value: 'false'
    }).catch(err => console.error(`AI Call Handler: [${callId}] Error setting AI_CALL_ACTIVE=false during escalation:`, err));

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error during escalation DB update:`, error);
    // If DB update fails, we might still want AGI to try and escalate or play an error.
    // The action returned to AGI will determine next steps.
    throw error;
  } finally {
    // Remove from active AI calls as it's being handed off by AGI's action.
    // The AGI script will receive an 'escalate' action and perform the transfer.
    activeAICalls.delete(callId);
    console.log(`AI Call Handler: [${callId}] Removed from active AI calls map due to escalation intent.`);
  }
}

// Conceptual: stop TTS if playing (not directly used in AGI flow where AGI plays TTS)
ttsService.stopPlaybackOnChannel = async (channel) => {
    console.log(`TTS Service (Conceptual): Stopping playback on channel ${channel}`);
    return Promise.resolve();
};
// Conceptual: stop STT recording (AGI's RECORD FILE handles its own termination)
sttService.stopRecording = async (channel) => {
    console.log(`STT Service (Conceptual): stopRecording called for ${channel}, usually handled by AGI.`);
    return Promise.resolve();
};

module.exports = {
  startAiCall,
  handleRecordedUtterance, // Replaces processRecordedAudio for AGI callback
  determineNextAiAction,   // For AGI to get initial/next prompt
  endAiCall,
  escalateCall,
  getActiveCallData: (callId) => activeAICalls.get(callId),
  CALL_STATE,
};
