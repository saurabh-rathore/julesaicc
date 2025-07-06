#!/usr/bin/env node

const readline = require('readline');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

// Environment variables
const PROCESS_UTTERANCE_URL = process.env.AGI_NOTIFY_PROCESS_URL || 'http://localhost:3000/api/internal/process-utterance';
const GENERATE_TTS_URL = process.env.AGI_NOTIFY_TTS_URL || 'http://localhost:3000/api/internal/generate-tts';
const NEXT_AI_ACTION_URL = process.env.AGI_NEXT_ACTION_URL || 'http://localhost:3000/api/internal/ai-next-action';

const AGI_RECORDING_PATH_PREFIX = process.env.RECORDING_PATH || '/tmp/asterisk_recordings';
const CUSTOMER_UTTERANCE_DURATION_MS = parseInt(process.env.CUSTOMER_UTTERANCE_DURATION_MS || "10000"); // Increased default
const MAX_SILENCE_SECONDS = parseInt(process.env.MAX_SILENCE_SECONDS || "3");
const TRANSFER_MESSAGE_TTS_DEFAULT = process.env.TRANSFER_MESSAGE_TTS || "Please wait while I transfer you.";
const ASTERISK_QUEUE_NAME = process.env.ASTERISK_QUEUE_NAME || 'support-queue';
const ASTERISK_QUEUE_CONTEXT = process.env.ASTERISK_QUEUE_CONTEXT || 'queues';
const DEFAULT_ERROR_MESSAGE_TTS = process.env.ERROR_MESSAGE_TTS || "I'm sorry, an error occurred.";

const agiVariables = {};
let currentCallId = '';
let currentChannel = '';
let currentLanguage = 'en';
let currentCallerIdNum = '';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

function logAGIMessage(message) {
  console.error(`AGI_LOG (${new Date().toISOString()}): ${message}`);
}

function sendAgiCommand(command) {
  return new Promise((resolve, reject) => {
    logAGIMessage(`SENDING: ${command}`);
    console.log(command);
    let responseBuffer = '';
    const timeout = setTimeout(() => {
        rl.removeListener('line', responseListener);
        reject(new Error(`AGI command timeout: ${command}`));
    }, 15000); // 15-second timeout for AGI commands

    const responseListener = (line) => {
      clearTimeout(timeout);
      logAGIMessage(`RECEIVED: ${line}`);
      responseBuffer += line + '\n';
      if (line.startsWith('200')) {
        rl.removeListener('line', responseListener);
        resolve(line);
      } else if (line.startsWith('5')) {
        rl.removeListener('line', responseListener);
        reject(new Error(`AGI Error: ${line} (Full response: ${responseBuffer})`));
      }
    };
    rl.on('line', responseListener);
  });
}

function makeHttpRequest(urlString, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(urlString);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // 10 second timeout for HTTP requests
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    logAGIMessage(`HTTP Request: ${method} ${urlString} Data: ${data ? JSON.stringify(data).substring(0,100) : 'None'}`);

    const req = protocol.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        logAGIMessage(`HTTP Response: ${res.statusCode} Body: ${responseBody.substring(0, 200)}...`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            logAGIMessage(`Error parsing JSON response: ${e.message}. Raw: ${responseBody}`);
            reject(new Error('Failed to parse backend JSON response'));
          }
        } else {
          reject(new Error(`HTTP request to ${urlString} failed with status ${res.statusCode}: ${responseBody}`));
        }
      });
    });
    req.on('timeout', () => {
        req.destroy();
        logAGIMessage(`HTTP Request Timeout: ${method} ${urlString}`);
        reject(new Error(`HTTP request timed out after ${options.timeout/1000} seconds`));
    });
    req.on('error', (e) => { logAGIMessage(`HTTP Request Error: ${e.message}`); reject(e); });
    if (data && (method === 'POST' || method === 'PUT')) req.write(JSON.stringify(data));
    req.end();
  });
}

async function playAgiTTS(textToSpeak) {
  if (!textToSpeak) return;
  logAGIMessage(`Requesting TTS for AGI playback: "${textToSpeak.substring(0, 50)}..."`);
  try {
    const ttsResponse = await makeHttpRequest(GENERATE_TTS_URL, 'POST', {
      callId: currentCallId,
      text: textToSpeak,
      language: currentLanguage
    });
    if (ttsResponse && ttsResponse.audioFilePath) {
      logAGIMessage(`Playing TTS audio via AGI: ${ttsResponse.audioFilePath}`);
      // Ensure file path is quoted if it contains spaces, though cuid shouldn't generate them
      await sendAgiCommand(`STREAM FILE "${ttsResponse.audioFilePath.replace(/"/g, '\\"')}" "#"`);
      try {
        await fs.unlink(ttsResponse.audioFilePath);
        logAGIMessage(`Deleted TTS file: ${ttsResponse.audioFilePath}`);
      } catch (unlinkErr) {
        logAGIMessage(`Error deleting TTS file ${ttsResponse.audioFilePath}: ${unlinkErr.message}`);
      }
    } else {
      logAGIMessage(`Failed to generate TTS or no audioFilePath. Response: ${JSON.stringify(ttsResponse)}`);
      await sendAgiCommand(`STREAM FILE "error" "#"`);
    }
  } catch (error) {
    logAGIMessage(`Error during TTS generation/playback for AGI: ${error.message}`);
    await sendAgiCommand(`STREAM FILE "error" "#"`);
  }
}

async function recordUserUtteranceAGI() {
  await sendAgiCommand('STREAM FILE "beep" "#"');
  const recordingFileBase = `${currentCallId}_utterance_agi_${Date.now()}`;
  const recordingFormat = 'wav';
  const finalRecordFileName = `${recordingFileBase}.${recordingFormat}`;
  const fullRecordPath = path.join(AGI_RECORDING_PATH_PREFIX, finalRecordFileName);

  const recordCommand = `RECORD FILE "${fullRecordPath.replace(/"/g, '\\"')}" ${recordingFormat} "#" ${CUSTOMER_UTTERANCE_DURATION_MS} 0 BEEP s=${MAX_SILENCE_SECONDS}`;
  logAGIMessage(`Executing AGI Record: ${recordCommand}`);
  const recordResultLine = await sendAgiCommand(recordCommand);
  logAGIMessage(`AGI Record result line: ${recordResultLine}`);

  let recordingTerminationReason = 'unknown';
  let dtmfDigit = null;

  if (recordResultLine.includes("result=0")) {
    recordingTerminationReason = recordResultLine.includes("(timeout)") ? 'timeout' : 'silence';
  } else if (recordResultLine.includes("result=-1")) {
    recordingTerminationReason = 'hangup';
    logAGIMessage('Recording failed: Channel hangup during recording.');
    return { filePath: null, reason: recordingTerminationReason, dtmf: null };
  } else {
    const dtmfMatch = recordResultLine.match(/result=(\d+)/);
    if (dtmfMatch && dtmfMatch[1]) {
      const resultCode = parseInt(dtmfMatch[1], 10);
      if (resultCode > 0) {
        dtmfDigit = String.fromCharCode(resultCode);
        recordingTerminationReason = 'dtmf';
        logAGIMessage(`Recording terminated by DTMF: ${dtmfDigit}`);
      }
    }
  }
  logAGIMessage(`Recording termination reason: ${recordingTerminationReason}`);

  if (recordingTerminationReason !== 'hangup') {
    try {
      await fs.access(fullRecordPath);
      logAGIMessage(`Recording file confirmed: ${fullRecordPath}`);
      return { filePath: fullRecordPath, reason: recordingTerminationReason, dtmf: dtmfDigit };
    } catch (fileAccessError) {
      logAGIMessage(`Recorded file ${fullRecordPath} not found. Termination: ${recordingTerminationReason}`);
      return { filePath: null, reason: 'file_not_found', dtmf: dtmfDigit };
    }
  }
  return { filePath: null, reason: recordingTerminationReason, dtmf: dtmfDigit };
}

async function mainAgiConversationLoop() {
  let keepLooping = true;
  let nextAiPrompt = null; // Stores prompt from backend if AI needs to speak before recording

  while (keepLooping) {
    logAGIMessage(`Loop Start. CallId: ${currentCallId}, Channel: ${currentChannel}. Requesting next AI action.`);
    // Determine what AI should do/say next by calling the backend
    // This replaces the direct TTS from backend for greeting in the old flow
    const aiActionUrl = `${NEXT_AI_ACTION_URL}?callId=${currentCallId}&channel=${encodeURIComponent(currentChannel)}`;
    let backendResponseToAction;
    try {
        backendResponseToAction = await makeHttpRequest(aiActionUrl, 'GET');
    } catch (error) {
        logAGIMessage(`Error fetching next AI action for ${currentCallId}: ${error.message}. Ending call.`);
        await playAgiTTS(DEFAULT_ERROR_MESSAGE_TTS);
        await sendAgiCommand('HANGUP');
        return;
    }

    logAGIMessage(`Backend response for next action: ${JSON.stringify(backendResponseToAction)}`);

    if (!backendResponseToAction || !backendResponseToAction.action) {
        logAGIMessage(`Invalid action from backend for ${currentCallId}. Ending call.`);
        await playAgiTTS(DEFAULT_ERROR_MESSAGE_TTS);
        await sendAgiCommand('HANGUP');
        return;
    }

    // Perform actions based on backend's instruction
    if (backendResponseToAction.action === 'speak_and_record' || backendResponseToAction.action === 'speak_and_hangup') {
      if (backendResponseToAction.text) {
        await playAgiTTS(backendResponseToAction.text);
      }
      if (backendResponseToAction.action === 'speak_and_hangup') {
        await sendAgiCommand('HANGUP');
        keepLooping = false;
        break;
      }
      // If 'speak_and_record', fall through to record
    } else if (backendResponseToAction.action === 'hangup') {
      await sendAgiCommand('HANGUP');
      keepLooping = false;
      break;
    } else if (backendResponseToAction.action === 'escalate') {
      const transferMsg = backendResponseToAction.text_to_speak_before_escalate || TRANSFER_MESSAGE_TTS_DEFAULT;
      await playAgiTTS(transferMsg);
      logAGIMessage(`Executing transfer to queue: ${ASTERISK_QUEUE_NAME}@${ASTERISK_QUEUE_CONTEXT}`);
      await sendAgiCommand(`EXEC Transfer "local/${ASTERISK_QUEUE_NAME}@${ASTERISK_QUEUE_CONTEXT}"`);
      await sendAgiCommand('HANGUP'); // AGI script hangs up after initiating transfer
      keepLooping = false;
      break;
    } else if (backendResponseToAction.action !== 'record') {
        logAGIMessage(`Unknown action '${backendResponseToAction.action}' from backend. Ending call.`);
        await playAgiTTS(DEFAULT_ERROR_MESSAGE_TTS);
        await sendAgiCommand('HANGUP');
        return;
    }

    // If we are here, it means action was 'record' or 'speak_and_record' (and not hangup)
    logAGIMessage(`Proceeding to record user utterance for call ${currentCallId}.`);
    const recording = await recordUserUtteranceAGI();

    if (!recording || !recording.filePath) {
      logAGIMessage(`Recording failed or no audio for ${currentCallId}. Termination reason: ${recording ? recording.reason : 'unknown'}.`);
      if (recording && recording.reason === 'hangup') {
          keepLooping = false; // Caller hung up during recording
          break;
      }
      // Backend's handleRecordedUtterance will get null/empty and decide to reprompt or hangup.
      // The next loop iteration will call /ai-next-action which will get that decision.
      // No, we need to send this failed recording attempt to backend so it can decide.
      try {
        const errorProcessingResponse = await makeHttpRequest(PROCESS_UTTERANCE_URL, 'POST', {
            callId: currentCallId,
            audioFilePath: null, // Indicate no successful recording
            language: currentLanguage,
            channel: currentChannel,
            recordingTerminationReason: recording ? recording.reason : 'unknown_recording_failure'
        });
        logAGIMessage(`Sent failed recording info. Backend response: ${JSON.stringify(errorProcessingResponse)}`);
        // The loop will continue, and nextActionResponse will be this errorProcessingResponse
        // which should ideally be a 'speak_and_record' with a retry message.
        if (errorProcessingResponse.action === 'hangup' || errorProcessingResponse.action === 'speak_and_hangup') {
            if(errorProcessingResponse.text) await playAgiTTS(errorProcessingResponse.text);
            await sendAgiCommand('HANGUP');
            keepLooping = false;
        } else if (errorProcessingResponse.action === 'escalate') {
            const transferMsg = errorProcessingResponse.text_to_speak_before_escalate || TRANSFER_MESSAGE_TTS_DEFAULT;
            await playAgiTTS(transferMsg);
            await sendAgiCommand(`EXEC Transfer "local/${ASTERISK_QUEUE_NAME}@${ASTERISK_QUEUE_CONTEXT}"`);
            await sendAgiCommand('HANGUP');
            keepLooping = false;
        }
        // If it's 'speak_and_record' or 'record', the loop will continue and fetch this prompt.
      } catch(e) {
        logAGIMessage(`Critical error notifying backend of failed recording for ${currentCallId}: ${e.message}. Hanging up.`);
        await playAgiTTS(DEFAULT_ERROR_MESSAGE_TTS);
        await sendAgiCommand('HANGUP');
        keepLooping = false;
      }

      if (!keepLooping) break;
      continue; // Restart loop to get next AI action (which should be the retry prompt)
    }

    // Send successful recording to backend for STT/LLM processing
    logAGIMessage(`Sending recorded audio ${recording.filePath} to backend for call ${currentCallId}.`);
    let processingResponse;
    try {
        processingResponse = await makeHttpRequest(PROCESS_UTTERANCE_URL, 'POST', {
            callId: currentCallId,
            audioFilePath: recording.filePath,
            language: currentLanguage,
            channel: currentChannel,
            recordingTerminationReason: recording.reason,
            dtmfDigit: recording.dtmf
        });
        logAGIMessage(`Backend processing response for ${currentCallId}: ${JSON.stringify(processingResponse)}`);

        // The AGI loop will now restart, and /ai-next-action will be called.
        // The backend (aiCallHandlerService.determineNextAiAction) needs to be aware of 'processingResponse'
        // to decide what the AI says next. This is a bit indirect.
        // A better flow: process-utterance returns the *next thing to say*.
        // Let's assume processUtteranceForAgi in internalController already calls aiCallHandlerService.handleRecordedUtterance,
        // and that function now returns the next action object directly.
        // The AGI loop then handles this action object.

        // This means the previous call to /ai-next-action becomes the primary source for what to say.
        // And /process-utterance is just for STT/LLM, and its response is effectively the *next* aiNextActionResponse.
        // The current loop structure is:
        // 1. GET /ai-next-action -> AGI gets { action: 'speak_and_record', text: 'AI says this' } or {action: 'record'}
        // 2. AGI plays text (if any), then records.
        // 3. AGI POSTS to /process-utterance with audio. Backend does STT/LLM.
        // 4. The response from /process-utterance *IS* the next action for AGI.
        // So, the AGI loop should use the response from /process-utterance directly.

        // Let's simplify. The 'mainAgiLoop' is one turn.
        // It starts by getting an AI prompt, plays it, records, sends to backend.
        // The backend's response to `process-utterance` dictates the *next* turn's AI prompt or action.
        // The AGI script then plays that next prompt and records again.

        // The current structure of the loop is:
        // 1. Get action (e.g. greeting)
        // 2. Play TTS for that action if needed
        // 3. Record user
        // 4. Send recording to backend. Backend processes and decides next AI text/action.
        // 5. The *next* loop iteration's call to /ai-next-action will fetch this new AI text/action.
        // This seems correct. The backend's `handleRecordedUtterance` updates the state in `activeAICalls`,
        // and `determineNextAiAction` reads this state to decide the next prompt.

        // So, if processingResponse indicates hangup or escalate, we need to act on it here.
         if (processingResponse.action === 'hangup' || processingResponse.action === 'speak_and_hangup') {
            if(processingResponse.text) await playAgiTTS(processingResponse.text); // Play final words if any
            await sendAgiCommand('HANGUP');
            keepLooping = false;
        } else if (processingResponse.action === 'escalate') {
            const transferMsg = processingResponse.text_to_speak_before_escalate || TRANSFER_MESSAGE_TTS_DEFAULT;
            await playAgiTTS(transferMsg);
            logAGIMessage(`Executing transfer to queue: ${ASTERISK_QUEUE_NAME}@${ASTERISK_QUEUE_CONTEXT}`);
            await sendAgiCommand(`EXEC Transfer "local/${ASTERISK_QUEUE_NAME}@${ASTERISK_QUEUE_CONTEXT}"`);
            await sendAgiCommand('HANGUP');
            keepLooping = false;
        }
        // If 'speak_and_record' or 'record', the loop continues, and `determineNextAiAction` will provide the text.

    } catch (e) {
        logAGIMessage(`Critical error processing utterance or getting next action for ${currentCallId}: ${e.message}. Hanging up.`);
        await playAgiTTS(DEFAULT_ERROR_MESSAGE_TTS);
        await sendAgiCommand('HANGUP');
        keepLooping = false;
    }

    if (!keepLooping) break;
  }
  logAGIMessage('AGI mainAgiConversationLoop ended.');
}


async function initAndMainLoop() {
  try {
    let line;
    while ((line = await new Promise(resolve => rl.once('line', resolve))) && line.trim() !== '') {
      const [key, value] = line.split(':').map(s => s.trim());
      agiVariables[key.toLowerCase()] = value;
    }

    currentCallId = agiVariables['agi_arg_1'] || agiVariables['agi_uniqueid'];
    currentCallerIdNum = agiVariables['agi_arg_2'] || agiVariables['agi_callerid'];
    currentLanguage = agiVariables['agi_arg_3'] || agiVariables['agi_language'] || 'en';
    currentChannel = agiVariables['agi_channel'];

    if (!currentCallId || !currentChannel || !currentCallerIdNum) {
      logAGIMessage("AGI Error: Missing critical call params (callId, channel, callerIdNum).");
      try { await sendAgiCommand('HANGUP'); } catch(e){}
      process.exit(1);
    }

    logAGIMessage(`AGI Script main_ai_interaction.agi.js started. CallID: ${currentCallId}, Channel: ${currentChannel}, Caller: ${currentCallerIdNum}, Lang: ${currentLanguage}`);

    await fs.mkdir(AGI_RECORDING_PATH_PREFIX, { recursive: true }).catch(dirError => {
        logAGIMessage(`AGI Warning: Could not create recording directory ${AGI_RECORDING_PATH_PREFIX}: ${dirError.message}. It might already exist or there's a permission issue.`);
    });

    await sendAgiCommand('ANSWER');
    await mainAgiConversationLoop();

  } catch (error) {
    logAGIMessage(`AGI Script CRITICAL Error: ${error.message} \nStack: ${error.stack}`);
    try { await sendAgiCommand('STREAM FILE "error" "#"'); } catch (e) { /* ignore */ }
  } finally {
    logAGIMessage(`AGI Script main_ai_interaction.agi.js for call ${currentCallId} finished.`);
    if (rl) rl.close();
    process.exit(0);
  }
}

initAndMainLoop();
