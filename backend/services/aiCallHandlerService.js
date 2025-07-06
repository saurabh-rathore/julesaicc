const amiService = require('./amiService');
const sttService = require('./sttService');
const llmService = require('./llmService');
const ttsService = require('./ttsService');
const callService = require('./callService'); // To update call status, log transcripts

// In-memory store for active AI calls and their state
// In a production system, this might be backed by Redis or a database for scalability and persistence
const activeAICalls = new Map(); // Key: callId (or channelId), Value: { callId, channel, language, state, history, ... }

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

    // 3. Transition to listening state
    await listenForCustomerInput(callId);

  } catch (error) {
    console.error(`AI Call Handler: Error starting call ${callId}:`, error);
    await endAiCall(callId, 'error');
  }
}

/**
 * Manages the state of listening for customer input.
 * @param {string} callId - The ID of the call.
 */
async function listenForCustomerInput(callId) {
  const callData = activeAICalls.get(callId);
  if (!callData || callData.state === CALL_STATE.ENDED) return;

  console.log(`AI Call Handler: [${callId}] Listening for customer input.`);
  updateCallState(callId, CALL_STATE.LISTENING);

  try {
    // Start recording - this needs a robust way to manage segment filenames and know when customer stops speaking.
    // For now, this is a simplified placeholder. VAD or explicit stop signal is needed.
    // The sttService.startRecording might need to return the actual filename determined by Asterisk.
    const recordingFileNameBase = `${callId}_customer_${Date.now()}`;
    // This is conceptual; actual recording path determination is complex.
    // Let's assume sttService.startRecording gives us a promise that resolves when recording is ready for STT.
    // Or, better, an event-driven approach where Asterisk signals end of speech.

    // TODO: This is a placeholder for a more complex VAD or speech detection mechanism.
    // For now, we'll simulate a recording period and then process.
    // In a real system, an AMI event (e.g., from Dialplan's SpeechBackground or VAD detection)
    // would trigger the next step.

    // Example: Using a simplified 'processAudioSegment' which internally handles start/stop/transcribe
    // This is highly conceptual and needs proper integration with Asterisk events for start/stop.
    // For this placeholder, let's assume processAudioSegment is called after some speech is detected.
    // We'll manually call a "pretend" audio processing function.
    // This function would typically be invoked by an event from Asterisk (e.g., end of speech detected by VAD).

    // Placeholder: Simulate waiting for customer to speak and then processing.
    // In a real app, this would be event-driven (e.g., AMI event for end-of-speech).
    // For now, let's assume we get a trigger to process a hypothetical recording.
    // This part needs to be fleshed out with actual Asterisk event handling.
    console.log(`AI Call Handler: [${callId}] Conceptual: Waiting for customer speech... This part needs event-driven implementation.`);
    // For demonstration, let's assume a function handleUserSpeech(callId, audioFilePath) is called externally.
    // Instead, we will now directly try to record and process.
    await processNextAiTurn(callId); // Start the first AI turn (listening)

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error in listening phase:`, error);
    await handleAiTurnError(callId, "Failed to start listening.");
  }
}

/**
 * Processes a full turn of AI interaction: Listen -> STT -> LLM -> TTS -> Listen again or End.
 * @param {string} callId The call ID.
 * @param {string} [aiPromptToSpeakFirst] Optional TTS prompt before listening.
 */
async function processNextAiTurn(callId, aiPromptToSpeakFirst = null) {
    const callData = activeAICalls.get(callId);
    if (!callData || callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) return;

    try {
        if (aiPromptToSpeakFirst) {
            updateCallState(callId, CALL_STATE.SPEAKING);
            await ttsService.speakOnChannel(callData.channel, aiPromptToSpeakFirst, callId, callData.language);
            // llmService already logs AI responses, but this is a direct prompt
            await callService.createTranscript({
                call_id: callId, speaker: 'ai', text: aiPromptToSpeakFirst,
                timestamp_start: 0, timestamp_end: 0, language: callData.language
            });
            callData.history.push({ speaker: 'ai', text: aiPromptToSpeakFirst, language: callData.language });
        }

        console.log(`AI Call Handler: [${callId}] Entering LISTENING state.`);
        updateCallState(callId, CALL_STATE.LISTENING);

        // Record customer's utterance
        // The duration might need to be dynamic or configurable
        const recordingDurationMs = parseInt(process.env.CUSTOMER_UTTERANCE_DURATION_MS || "7000");
        const audioFilePath = await sttService.recordUtterance(callData.channel, callId, recordingDurationMs);

        if (!audioFilePath) {
            console.warn(`AI Call Handler: [${callId}] No audio file path returned from recording. Assuming no input.`);
            // Potentially play a "didn't hear anything" message and retry or hang up after N attempts.
            await ttsService.speakOnChannel(callData.channel, "I didn't hear anything. Please try again.", callId, callData.language);
            await processNextAiTurn(callId); // Retry listening
            return;
        }

        console.log(`AI Call Handler: [${callId}] Processing customer speech from ${audioFilePath}`);
        updateCallState(callId, CALL_STATE.PROCESSING_STT);

        const transcriptionResult = await sttService.transcribeAudio(audioFilePath, callData.language);
        const customerText = transcriptionResult.text ? transcriptionResult.text.trim() : "";
        const detectedLanguage = transcriptionResult.language || callData.language;

        console.log(`AI Call Handler: [${callId}] STT Result (lang: ${detectedLanguage}): "${customerText}"`);

        // Clean up the recorded audio file
        try {
            await fs.promises.unlink(audioFilePath);
            console.log(`AI Call Handler: [${callId}] Deleted temporary recording ${audioFilePath}`);
        } catch (unlinkError) {
            console.error(`AI Call Handler: [${callId}] Error deleting temporary recording ${audioFilePath}:`, unlinkError);
        }

        if (!customerText) {
            console.log(`AI Call Handler: [${callId}] Empty transcription.`);
            await handleAiTurnError(callId, "Sorry, I didn't catch that. Could you please repeat?");
            return;
        }

        await callService.createTranscript({
            call_id: callId,
            speaker: 'customer',
            text: customerText,
            timestamp_start: transcriptionResult.segments && transcriptionResult.segments.length > 0 ? transcriptionResult.segments[0].start : 0,
            timestamp_end: transcriptionResult.segments && transcriptionResult.segments.length > 0 ? transcriptionResult.segments[transcriptionResult.segments.length -1].end : 0,
            language: detectedLanguage,
        });
        callData.history.push({ speaker: 'customer', text: customerText, language: detectedLanguage });
        updateCallState(callId, CALL_STATE.QUERYING_LLM);

        // Construct prompt for LLM, potentially including history
        let llmPrompt = "";
        // Simple history concatenation, could be more sophisticated
        callData.history.slice(-5).forEach(turn => { // Last 5 turns
            llmPrompt += `${turn.speaker === 'ai' ? 'AI' : 'Customer'}: ${turn.text}\n`;
        });
        // The current customerText is already the last item in history if added above.
        // Or, if not adding to history until after LLM, use: llmPrompt += `Customer: ${customerText}\nAI:`;

        const llmResponseText = await llmService.queryLLM(
            customerText, // Or use the constructed llmPrompt if including history
            callId,
            callData.callerIdNum,
            { /* options like system prompt if not handled in llmService already */ }
        );

        updateCallState(callId, CALL_STATE.GENERATING_TTS);
        await ttsService.speakOnChannel(callData.channel, llmResponseText, callId, callData.language);
        callData.history.push({ speaker: 'ai', text: llmResponseText, language: callData.language });

        // Check for escalation trigger or end of call from LLM response
        if (llmResponseText.toLowerCase().includes("transfer to agent") || llmResponseText.toLowerCase().includes("speak to a representative")) {
            await escalateCall(callId, "llm_request_escalation");
        } else if (llmResponseText.toLowerCase().includes("goodbye") || llmResponseText.toLowerCase().includes("thank you for calling")) {
            await endAiCall(callId, "completed_by_ai");
        } else {
            // Loop back for next turn
            await processNextAiTurn(callId);
        }

    } catch (error) {
        console.error(`AI Call Handler: [${callId}] Error in AI turn:`, error);
        await handleAiTurnError(callId, "I'm having trouble processing your request right now. Please try again in a moment.");
    }
}


/**
 * Handles errors during an AI turn, plays an error message, and returns to listening or ends call.
 * @param {string} callId
 * @param {string} errorMessageToSpeak
 */
async function handleAiTurnError(callId, errorMessageToSpeak) {
  const callData = activeAICalls.get(callId);
  if (!callData || callData.state === CALL_STATE.ENDED) return;

  try {
    // Avoid speaking if already escalating or ending
    if (callData.state !== CALL_STATE.ESCALATING && callData.state !== CALL_STATE.ENDED) {
        updateCallState(callId, CALL_STATE.SPEAKING); // AI is speaking an error
        await ttsService.speakOnChannel(callData.channel, errorMessageToSpeak, callId, callData.language);
        await callService.createTranscript({ call_id: callId, speaker: 'ai', text: errorMessageToSpeak, timestamp_start: 0, timestamp_end: 0, language: callData.language });
        callData.history.push({ speaker: 'ai', text: errorMessageToSpeak, language: callData.language });
    }
  } catch (ttsError) {
    console.error(`AI Call Handler: [${callId}] Critical error: Failed to play error message via TTS:`, ttsError);
  }

  // Decide whether to retry or end the call
  // For now, let's retry once, then end if error persists (simple example)
  callData.errorCount = (callData.errorCount || 0) + 1;
  if (callData.errorCount > 1) {
      console.warn(`AI Call Handler: [${callId}] Multiple errors, ending call.`);
      await endAiCall(callId, 'error_max_retries');
  } else if (callData.state !== CALL_STATE.ESCALATING && callData.state !== CALL_STATE.ENDED) {
      await processNextAiTurn(callId); // Try another turn (listen again)
  }
}

/**
 * Ends an AI call and cleans up resources.
 * @param {string} callId - The ID of the call to end.
 * @param {string} disposition - The final disposition of the call (e.g., 'completed', 'escalated', 'error').
 */
async function endAiCall(callId, disposition = 'completed') {
  const callData = activeAICalls.get(callId);
  if (!callData) {
    // console.log(`AI Call Handler: Call ${callId} not found or already ended.`);
    return;
  }

  console.log(`AI Call Handler: [${callId}] Ending call with disposition: ${disposition}. Current state: ${callData.state}`);

  // Prevent further actions if already ending or ended
  if (callData.state === CALL_STATE.ENDED || callData.state === CALL_STATE.ESCALATING) {
      // If escalating, the escalation logic should handle final state.
      // If already ended, do nothing.
      return;
  }

  updateCallState(callId, CALL_STATE.ENDED);

  try {
    // Stop any active recording for this call/channel
    if (callData.channel) { // Ensure channel info is available
        await sttService.stopRecording(callData.channel);
    }

    // Update call log in database
    await callService.updateCall(callId, {
      status: disposition === 'error' ? 'failed' : disposition, // Map to DB status enum
      end_time: new Date(),
      final_disposition: disposition,
    });
    console.log(`AI Call Handler: [${callId}] Call log updated. Status: ${disposition}`);
  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error during call cleanup:`, error);
  } finally {
    activeAICalls.delete(callId);
    console.log(`AI Call Handler: [${callId}] Removed from active calls. Total active: ${activeAICalls.size}`);
    // Note: Do not hang up the channel from here directly using AMI 'Hangup' action
    // unless absolutely necessary and you know the dialplan won't handle it.
    // Usually, Asterisk dialplan or the channel itself (e.g., user hangs up) terminates the channel.
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
      status: 'escalating', // Intermediate status
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
      // We mark it as ended in our active calls map because AI handler is done.
      activeAICalls.delete(callId); // AI hands off control
       console.log(`AI Call Handler: [${callId}] Removed from active AI calls after escalation handoff. Total active: ${activeAICalls.size}`);

    } else {
      console.error(`AI Call Handler: [${callId}] Failed to redirect call to queue. AMI Response:`, amiResponse);
      // If redirect fails, what to do? Try again? Play error? Hang up?
      // For now, log error and potentially revert state or try to end call gracefully.
      updateCallState(callId, oldState); // Revert state if redirect failed
      throw new Error(`Failed to redirect call: ${amiResponse.message}`);
    }

  } catch (error) {
    console.error(`AI Call Handler: [${callId}] Error during escalation process:`, error);
    updateCallState(callId, oldState); // Revert state on error
    // Potentially play an error message to the user if the call is still active
    try {
        await ttsService.speakOnChannel(callData.channel, "Sorry, I was unable to transfer your call at this moment. Please try again later.", callId, callData.language);
    } catch (speakError) {
        console.error(`AI Call Handler: [${callId}] Failed to play escalation error message:`, speakError);
    }
    // Consider ending the call if escalation fails critically
    await endAiCall(callId, 'escalation_failed');
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
