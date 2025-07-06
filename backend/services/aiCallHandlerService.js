const fs = require('fs').promises; // Added for unlink
const amiService = require('./amiService');
const sttService = require('./sttService');
const llmService = require('./llmService');
const ttsService = require('./ttsService');
const callService = require('./callService'); // To update call status, log transcripts
const customerPlanService = require('./customerPlanService'); // Added for plan lookup

// In-memory store for active AI calls and their state
const activeAICalls = new Map();

// Call States
const CALL_STATE = {
  NEW: 'NEW', // Call has been identified for AI handling
  GREETING: 'GREETING', // AI is playing a greeting message
  LISTENING: 'LISTENING', // AI is actively recording/listening for customer input
  PROCESSING_STT: 'PROCESSING_STT', // AI is processing recorded audio to text
  QUERYING_LLM: 'QUERYING_LLM', // AI is querying the language model
  GENERATING_TTS: 'GENERATING_TTS', // AI is generating audio response
  SPEAKING: 'SPEAKING', // AI is playing the audio response
  WAITING_FOR_HANGUP: 'WAITING_FOR_HANGUP', // AI has finished its part, waiting for user to hang up or timeout
  ESCALATING: 'ESCALATING', // Call is being escalated
  ENDED: 'ENDED', // Call has ended
};

/**
 * Initializes and starts handling a new AI call.
 * This would typically be triggered by an AMI event (e.g., Newchannel, or a specific event from dialplan).
 * @param {string} callId - The unique ID for this call (from callService.createCall).
 * @param {string} channel - The Asterisk channel identifier (e.g., 'SIP/somepeer-000000a1').
 * @param {string} callerIdNum - The caller's phone number.
 * @param {string} [language='en'] - The language for the call.
 */
async function startAiCall(callId, channel, callerIdNum, language = 'en') {
  console.log(`AI Call Handler: Starting AI call for callId: ${callId}, channel: ${channel}`);
  if (activeAICalls.has(callId)) {
    console.warn(`AI Call Handler: Call ${callId} is already being handled.`);
    return;
  }

  activeAICalls.set(callId, {
    callId,
    channel,
    callerIdNum,
    language,
    state: CALL_STATE.NEW,
    history: [], // To store conversation turns { speaker, text }
    currentRecordingPath: null,
    lastActivityTime: Date.now(),
  });

  try {
    // 1. Update call status in DB
    await callService.updateCall(callId, { status: 'answered_ai' });
    updateCallState(callId, CALL_STATE.GREETING);

    // 2. Play a greeting message (example)
    const greetingText = "Hello! How can I help you today?";
    await ttsService.speakOnChannel(channel, greetingText, callId, language);
    await callService.createTranscript({ call_id: callId, speaker: 'ai', text: greetingText, timestamp_start: 0, timestamp_end: 0 /* TODO: Actual timing */ });
    activeAICalls.get(callId).history.push({ speaker: 'ai', text: greetingText });

    // 3. Set AI_CALL_ACTIVE=true via AMI and transition to LISTENING state.
    // The dialplan will then take over and call the AGI script.
    await amiService.sendAction({
        action: 'SetVar',
        channel: channel,
        variable: 'AI_CALL_ACTIVE',
        value: 'true'
    });
    console.log(`AI Call Handler: [${callId}] Set AI_CALL_ACTIVE=true on channel ${channel}`);

    updateCallState(callId, CALL_STATE.LISTENING);
    console.log(`AI Call Handler: [${callId}] Call initiated, greeting played. State: LISTENING. Dialplan should now invoke AGI script.`);

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error in initial AI call setup:`, error);
    await endAiCall(callId, 'error_setup', channel); // Pass channel for potential hangup
  }
}

// Remove listenForCustomerInput as its logic is merged into AGI flow
// async function listenForCustomerInput(callId) { ... }

// Renamed handleCustomerSpeech to processRecordedAudio and it's now the main entry point after AGI.
/**
 * Processes the recorded audio file after AGI script signals completion via internal API.
 * This function contains the STT, LLM, TTS logic for an AI turn.
 * @param {string} callId The call ID.
 * @param {string} audioFilePath Path to the recorded audio file.
 * @param {string} agiDetectedLanguage Language detected or passed by AGI.
 */
async function processRecordedAudio(callId, audioFilePath, agiDetectedLanguage) {
    const callData = activeAICalls.get(callId);
    if (!callData || callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) {
        console.warn(`AI Call Handler: [${callId}] Received recording for an inactive/ended call. Path: ${audioFilePath}`);
        if (audioFilePath) {
            try { await fs.unlink(audioFilePath); } catch (e) { console.error(`AI Call Handler: Error unlinking orphaned recording ${audioFilePath}`, e); }
        }
        return;
    }

    // Use language from AGI if available, otherwise fallback to call's initial language
    const currentLanguage = agiDetectedLanguage || callData.language;
    if (callData.language !== currentLanguage) {
        console.log(`AI Call Handler: [${callId}] Language for this turn set to: ${currentLanguage} (was ${callData.language})`);
        callData.language = currentLanguage;
    }

    console.log(`AI Call Handler: [${callId}] Processing recorded audio: ${audioFilePath} for language: ${callData.language}`);
    updateCallState(callId, CALL_STATE.PROCESSING_STT);

    try {
        const transcriptionResult = await sttService.transcribeAudio(audioFilePath, callData.language);
        const customerText = transcriptionResult.text ? transcriptionResult.text.trim() : "";
        // Use language from STT result if available, otherwise stick with currentLanguage
        const sttLanguage = transcriptionResult.language || callData.language;

        console.log(`AI Call Handler: [${callId}] STT Result (lang: ${sttLanguage}): "${customerText}"`);

        if (audioFilePath) {
            try {
                await fs.unlink(audioFilePath);
                console.log(`AI Call Handler: [${callId}] Deleted temporary recording ${audioFilePath}`);
            } catch (unlinkError) {
                console.error(`AI Call Handler: [${callId}] Error deleting temp recording ${audioFilePath}:`, unlinkError);
            }
        }

        if (!customerText) {
            console.log(`AI Call Handler: [${callId}] Empty transcription from STT.`);
            // Play "didn't understand" and set state to LISTENING. Dialplan loop will re-trigger AGI.
            await ttsService.speakOnChannel(callData.channel, process.env.DID_NOT_UNDERSTAND_MESSAGE || "Sorry, I didn't catch that. Could you please repeat?", callId, callData.language);
            await callService.createTranscript({ call_id: callId, speaker: 'ai', text: process.env.DID_NOT_UNDERSTAND_MESSAGE || "Sorry, I didn't catch that. Could you please repeat?", timestamp_start: 0, timestamp_end: 0, language: callData.language });
            callData.history.push({ speaker: 'ai', text: process.env.DID_NOT_UNDERSTAND_MESSAGE || "Sorry, I didn't catch that. Could you please repeat?", language: callData.language });
            updateCallState(callId, CALL_STATE.LISTENING);
            console.log(`AI Call Handler: [${callId}] Awaiting next customer input via AGI after empty/failed transcription.`);
            return; // Dialplan will loop back to AGI
        }

        await callService.createTranscript({
            call_id: callId,
            speaker: 'customer',
            text: customerText,
            timestamp_start: transcriptionResult.segments && transcriptionResult.segments.length > 0 ? transcriptionResult.segments[0].start : 0,
            timestamp_end: transcriptionResult.segments && transcriptionResult.segments.length > 0 ? transcriptionResult.segments[transcriptionResult.segments.length -1].end : 0,
            language: sttLanguage,
        });
        callData.history.push({ speaker: 'customer', text: customerText, language: sttLanguage });
        updateCallState(callId, CALL_STATE.QUERYING_LLM);

        // Construct system prompt with customer plan context
        let systemPrompt = `You are a helpful AI assistant for a telecom company. The customer is speaking ${sttLanguage}.`;
        try {
            const plan = await customerPlanService.findCustomerPlanByIdentifier(callData.callerIdNum);
            if (plan) {
                systemPrompt += ` The customer's current plan is "${plan.plan_name}". Plan details: ${JSON.stringify(plan.plan_details)}.`;
            }
        } catch(planError) {
            console.error(`AI Call Handler: [${callId}] Error fetching customer plan for LLM context: ${planError.message}`);
        }

        // Pass conversation history to LLM
        const llmResponseText = await llmService.queryLLM(
            customerText, // Current user utterance
            callId,
            callData.callerIdNum, // For logging/internal use by LLM service if needed beyond plan lookup
            { system: systemPrompt, conversation_history: callData.history.slice(-10) } // Pass recent history
        );
        // llmService.queryLLM is already logging the AI response as a transcript.
        callData.history.push({ speaker: 'ai', text: llmResponseText, language: callData.language });

        updateCallState(callId, CALL_STATE.GENERATING_TTS);
        // This TTS playback should ideally be blocking or signal completion if the dialplan loop is very tight.
        // For now, we assume the 1-second Wait in dialplan is a crude sync mechanism.
        await ttsService.speakOnChannel(callData.channel, llmResponseText, callId, callData.language);

        if (llmResponseText.toLowerCase().includes("transfer to agent") || llmResponseText.toLowerCase().includes("speak to a representative")) {
            await escalateCall(callId, "llm_request_escalation");
        } else if (llmResponseText.toLowerCase().includes("goodbye") || llmResponseText.toLowerCase().includes("thank you for calling")) {
            await endAiCall(callId, "completed_by_ai", callData.channel);
        } else {
            // If conversation continues, set state to LISTENING.
            // The Asterisk dialplan (extensions.conf) will loop back to the AGI script.
            updateCallState(callId, CALL_STATE.LISTENING);
            console.log(`AI Call Handler: [${callId}] AI turn complete. Awaiting next customer input via AGI.`);
        }

    } catch (error) {
        console.error(`AI Call Handler: [${callId}] Error processing recorded audio:`, error);
        await handleAiTurnError(callId, process.env.ERROR_MESSAGE_TTS || "I'm having trouble processing your request right now. Please try again in a moment.", true);
    }
}


/**
 * Handles errors during an AI turn, plays an error message, and prepares for next turn or ends call.
 * @param {string} callId
 * @param {string} errorMessageToSpeak
 * @param {boolean} shouldRetryViaAgi - If true, sets state to LISTENING for AGI to take over.
 */
async function handleAiTurnError(callId, errorMessageToSpeak, shouldRetryViaAgi = false) {
  const callData = activeAICalls.get(callId);
  if (!callData || callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) return;

  try {
    if (callData.state !== CALL_STATE.ESCALATING && callData.state !== CALL_STATE.ENDED) {
        updateCallState(callId, CALL_STATE.SPEAKING);
        await ttsService.speakOnChannel(callData.channel, errorMessageToSpeak, callId, callData.language);
        await callService.createTranscript({ call_id: callId, speaker: 'ai', text: errorMessageToSpeak, timestamp_start: 0, timestamp_end: 0, language: callData.language });
        callData.history.push({ speaker: 'ai', text: errorMessageToSpeak, language: callData.language });
    }
  } catch (ttsError) {
    console.error(`AI Call Handler: [${callId}] Critical error: Failed to play error message via TTS:`, ttsError);
  }

  callData.errorCount = (callData.errorCount || 0) + 1;
  if (callData.errorCount > 1 || !shouldRetryViaAgi) {
      console.warn(`AI Call Handler: [${callId}] Multiple errors or no retry, ending call.`);
      await endAiCall(callId, 'error_max_retries', callData.channel);
  } else if (callData.state !== CALL_STATE.ESCALATING && callData.state !== CALL_STATE.ENDED) {
      updateCallState(callId, CALL_STATE.LISTENING);
      console.log(`AI Call Handler: [${callId}] AI turn error, preparing for retry. Awaiting next customer input via AGI.`);
      // The dialplan loop will handle re-calling AGI.
  }
}

/**
 * Ends an AI call and cleans up resources.
 * @param {string} callId - The ID of the call to end.
 * @param {string} disposition - The final disposition of the call (e.g., 'completed', 'escalated', 'error').
 * @param {string} [channel] - Optional channel identifier, useful if callData might not be in activeAICalls.
 */
async function endAiCall(callId, disposition = 'completed', channel = null) {
  const callData = activeAICalls.get(callId);

  if (!callData && !channel) {
    console.log(`AI Call Handler: Cannot end call ${callId}. No active call data and no channel provided.`);
    return;
  }

  const currentChannel = callData ? callData.channel : channel;

  if (!callData) {
    // console.log(`AI Call Handler: Call ${callId} not found in active calls, but attempting to finalize based on event (e.g., hangup).`);
    // If callData is not found, it might have been already removed (e.g. by escalation)
    // or this is a hangup event for a call that wasn't fully tracked by AI handler.
    // We can still try to update the DB record if it exists.
    try {
        // Check if a call record exists to update its end_time and status
        const existingCall = await callService.getCallById(callId);
        if (existingCall && existingCall.status !== 'completed' && existingCall.status !== 'failed' && existingCall.status !== 'escalated') {
             await callService.updateCall(callId, {
                status: disposition === 'error' ? 'failed' : (disposition.startsWith('completed') ? 'completed' : disposition),
                end_time: new Date(),
                final_disposition: disposition,
             });
             console.log(`AI Call Handler: [${callId}] Call log updated for inactive/untracked call. Status: ${disposition}`);
        }
    } catch (error) {
        console.error(`AI Call Handler: [${callId}] Error updating DB for inactive/untracked call:`, error);
    }
    // No activeAICalls entry to delete if callData is null.
    // Hanging up the channel explicitly might be risky if we don't know its exact state.
    // The 'h' extension in dialplan is a safer bet for cleanup if channel is provided.
    return;
  }

  // If callData exists:
  console.log(`AI Call Handler: [${callId}] Ending call with disposition: ${disposition}. Current state: ${callData.state}`);

  // Prevent further actions if already ending or ended by this logic
  if (callData.state === CALL_STATE.ENDED) {
    console.log(`AI Call Handler: [${callId}] Call already marked as ENDED.`);
    return;
  }

  console.log(`AI Call Handler: [${callId}] Ending call with disposition: ${disposition}. Current state: ${callData.state}`);

  // Prevent further actions if already ending or ended
  if (callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) {
      // If escalating, the escalation logic should handle final state.
      // If already ended, do nothing.
      return;
  }

  updateCallState(callId, CALL_STATE.ENDED); // Mark as ended in our state machine

  try {
    // Set AI_CALL_ACTIVE to false to stop dialplan loop
    if (callData.channel) {
        console.log(`AI Call Handler: [${callId}] Setting AI_CALL_ACTIVE=false on channel ${callData.channel}`);
        await amiService.sendAction({
            action: 'SetVar',
            channel: callData.channel,
            variable: 'AI_CALL_ACTIVE',
            value: 'false'
        }).catch(err => console.error(`AI Call Handler: [${callId}] Error setting AI_CALL_ACTIVE=false:`, err)); // Log error but continue
    }

    // Stop any active recording for this call/channel (sttService.stopRecording was for Monitor, may not be needed for AGI's Record)
    // The AGI 'RECORD FILE' command stops on its own (silence, timeout, escape digit).
    // If sttService.stopRecording was intended for Monitor, it's likely safe to remove or make conditional.
    // For now, commenting out as AGI handles its own recording lifecycle.
    // if (callData.channel) {
    //     await sttService.stopRecording(callData.channel);
    // }

    // Update call log in database
    const dbStatus = disposition.startsWith('error') ? 'failed' :
                     disposition.startsWith('completed') ? 'completed' :
                     disposition; // Handles 'escalated' directly

    await callService.updateCall(callId, {
      status: dbStatus,
      end_time: new Date(),
      final_disposition: disposition,
    });
    console.log(`AI Call Handler: [${callId}] Call log updated. Status: ${dbStatus}, Disposition: ${disposition}`);

    // Explicitly hang up the channel via AMI if AI is ending the call
    // (e.g., 'completed_by_ai', 'error_max_retries')
    // Don't hang up if it was an 'escalated' disposition, as Redirect handles that.
    // Also, don't hang up if disposition is like 'hangups_cause_X' as Asterisk already hung up.
    if (currentChannel && (disposition === 'completed_by_ai' || disposition === 'error_max_retries' || disposition === 'error_setup')) {
        console.log(`AI Call Handler: [${callId}] AI ending call. Issuing Hangup for channel ${currentChannel}`);
        await amiService.sendAction({
            action: 'Hangup',
            channel: currentChannel,
            // cause: 16 // Normal Clearing, if needed
        }).catch(err => console.error(`AI Call Handler: [${callId}] Error sending Hangup command:`, err));
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

function updateCallState(callId, newState) {
  const callData = activeAICalls.get(callId);
  if (callData) {
    console.log(`AI Call Handler: [${callId}] State transition: ${callData.state} -> ${newState}`);
    callData.state = newState;
    callData.lastActivityTime = Date.now();
  }
}

// This service needs to be integrated with AMI events from amiService.js
// For example, in index.js:
// amiService.on('new_channel', (event) => { /* ... identify relevant call ... */ startAiCall(callId, channel, ...); });
// amiService.on('hangup', (event) => { /* ... identify callId ... */ endAiCall(callId, 'completed_hangup'); });
// amiService.on('some_vad_event_or_dtmf', (event) => { /* ... identify callId and audio_path ... */ handleCustomerSpeech(callId, audioFilePath); });


// TODO: Implement timeout for inactive calls
// setInterval(() => {
//   const now = Date.now();
//   activeAICalls.forEach((call, callId) => {
//     if (now - call.lastActivityTime > MAX_INACTIVITY_TIMEOUT) {
//       console.log(`AI Call Handler: [${callId}] Call timed out due to inactivity.`);
//       endAiCall(callId, 'timeout_error');
//     }
//   });
// }, 60000); // Check every minute


module.exports = {
  startAiCall,
  handleCustomerSpeech, // This would be invoked by an event indicating customer speech is ready
  endAiCall,
  getActiveCallData: (callId) => activeAICalls.get(callId), // For inspection or other modules
  CALL_STATE,
  escalateCall, // Export the new function
};

/**
 * Initiates call escalation to a human agent queue.
 * @param {string} callId - The ID of the call to escalate.
 * @param {string} [reason='escalated_by_ai'] - Reason for escalation.
 */
async function escalateCall(callId, reason = 'escalated_by_ai') {
  const callData = activeAICalls.get(callId);
  if (!callData || callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) {
    console.warn(`AI Call Handler: [${callId}] Call already ended, escalating, or not found. Cannot escalate.`);
    return;
  }

  console.log(`AI Call Handler: [${callId}] Escalating call. Reason: ${reason}`);
  const oldState = callData.state;
  updateCallState(callId, CALL_STATE.ESCALATING);

  try {
    // Stop any current AI activities like recording or TTS if applicable
    await ttsService.stopPlaybackOnChannel(callData.channel); // Conceptual: stop TTS if playing
    await sttService.stopRecording(callData.channel); // Stop any active recording

    // Play a message to the user about transferring
    const transferMessage = "Please wait while I transfer you to a human agent.";
    await ttsService.speakOnChannel(callData.channel, transferMessage, callId, callData.language);
    // Log this AI message
    await callService.createTranscript({
        call_id: callId,
        speaker: 'ai',
        text: transferMessage,
        timestamp_start: 0, // Placeholder
        timestamp_end: 0    // Placeholder
    });
    callData.history.push({ speaker: 'ai', text: transferMessage });


    // Update call record in DB before attempting transfer
    await callService.updateCall(callId, {
      status: 'escalating',
      final_disposition: reason,
    });

    // Use AMI to transfer the call to the queue
    // The queue details (e.g., 'support-queue', context 'queues') should be in extensions.conf
    const action = {
      action: 'Redirect',
      channel: callData.channel,
      context: process.env.ASTERISK_QUEUE_CONTEXT || 'queues', // e.g., 'queues'
      exten: process.env.ASTERISK_QUEUE_NAME || 'support-queue',   // e.g., 'support-queue'
      priority: '1',
    };

    console.log(`AI Call Handler: [${callId}] Sending Redirect to AMI:`, action);
    const amiResponse = await amiService.sendAction(action);

    if (amiResponse.response === 'Success') {
      console.log(`AI Call Handler: [${callId}] Call successfully redirected to queue ${action.exten}.`);
      // The call is now handled by Asterisk's queue logic.
      // We can consider this AI part of the call ended from a control perspective.
      // The 'endAiCall' function will be called by a Hangup event from Asterisk eventually.
      // Or, if Redirect means AMI loses control, we might need to update status here.
      // For now, assume Hangup event will finalize.
      // The call is now outside of the AI's direct dialplan loop.
      activeAICalls.delete(callId);
      console.log(`AI Call Handler: [${callId}] Removed from active AI calls after successful escalation redirect. Total active: ${activeAICalls.size}`);
      // No need to set AI_CALL_ACTIVE to false here as the call is no longer in our AI context.

    } else {
      console.error(`AI Call Handler: [${callId}] Failed to redirect call to queue. AMI Response:`, amiResponse);
      updateCallState(callId, oldState); // Revert state if redirect failed
      // Attempt to inform user and then end the call from AI side.
      await ttsService.speakOnChannel(callData.channel, "Sorry, I was unable to transfer your call. Please try again later.", callId, callData.language)
        .catch(speakErr => console.error(`AI Call Handler: [${callId}] Failed to play escalation failure message: ${speakErr.message}`));
      await endAiCall(callId, 'escalation_failed_technical', callData.channel); // End call if redirect fails
      throw new Error(`Failed to redirect call: ${amiResponse.message}`); // Propagate error
    }

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error during escalation process:`, error);
    // Ensure state is reverted if not already done
    if (callData.state !== CALL_STATE.ENDED) {
        updateCallState(callId, oldState);
    }
    // Potentially play an error message to the user if the call is still active and not already ended
    if (callData.state !== CALL_STATE.ENDED) {
        try {
            await ttsService.speakOnChannel(callData.channel, process.env.ERROR_MESSAGE_TTS || "Sorry, an error occurred during the transfer attempt.", callId, callData.language);
        } catch (speakError) {
            console.error(`AI Call Handler: [${callId}] Failed to play escalation error message:`, speakError);
        }
    }
    // End the call if it hasn't been ended by a more specific failure handler
    if (callData.state !== CALL_STATE.ENDED) {
        await endAiCall(callId, 'escalation_error', callData.channel);
    }
  }
}

// Need a way to stop TTS if it's currently playing, e.g. when escalating
// This is conceptual and would need to be added to ttsService.js
ttsService.stopPlaybackOnChannel = async (channel) => {
    // This function would need to find any active playback associated with the channel
    // and issue an AMI command to stop it, e.g., by redirecting the channel to a hangup extension
    // or if 'Playback' action returns a unique ID that can be used to stop it.
    // For now, this is a placeholder.
    console.log(`TTS Service (Conceptual): Stopping playback on channel ${channel}`);
    // Example: Might involve redirecting to a dead-end to stop audio.
    // Or if using Playback with an ID:
    // const action = { action: 'StopMixMonitor', channel: channel, mixmonitorid: 'id_of_playback' };
    // This is complex and depends on how playback is initiated and controlled.
    return Promise.resolve();
};
