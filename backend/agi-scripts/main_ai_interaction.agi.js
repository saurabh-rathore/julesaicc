#!/usr/bin/env node

const readline = require('readline');
const http = require('http');
const querystring = require('querystring');
const fs = require('fs'); // For checking file existence, path manipulation
const path = require('path');

// Configuration - these should match what's expected by the main backend
const NOTIFY_URL = process.env.AGI_NOTIFY_URL || 'http://localhost:3000/api/internal/recording-complete';
// RECORDING_BASE_PATH should be set in .env for the main app, and the AGI script needs to know it too.
// For simplicity, we'll make it an assumption or pass it if possible.
// However, Asterisk's RECORD FILE writes where Asterisk has permission.
// The AGI script will tell Asterisk *where* to write it.
const AGI_RECORDING_PATH_PREFIX = process.env.RECORDING_PATH || '/tmp/asterisk_recordings'; // Match sttService

const agiVariables = {};
let agiInputBuffer = '';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Function to send command to Asterisk and get response
function sendCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(command); // Send command to Asterisk via stdout

    const responseListener = (line) => {
      // AGI responses are like: 200 result=0 (some_value) or 200 result=-1
      // Or 510 Invalid or unknown command
      // Or 520 Usage error
      if (line.startsWith('200')) {
        rl.removeListener('line', responseListener); // Clean up listener
        resolve(line);
      } else if (line.startsWith('5')) {
        rl.removeListener('line', responseListener);
        reject(new Error(`AGI Error: ${line}`));
      }
      // Keep listening if it's not a final response line yet (e.g. variable settings)
    };
    rl.on('line', responseListener);
  });
}

// Function to parse AGI result line (e.g., "200 result=0 (filename.wav)")
function parseRecordFileResult(resultLine) {
    // Example result: "200 result=0 (filename=/tmp/recorded_audio.wav)"
    // Or "200 result=0 endpos=XXXX (timeout)" or (hangup) or (dtmf)
    // We are interested in the filename if provided, or just success.
    // The `RECORD FILE` command in Asterisk AGI returns the filename in parentheses if successful.
    const match = resultLine.match(/\(filename=(.*?)\)/);
    if (match && match[1]) {
        return match[1];
    }
    // If filename isn't explicitly returned this way, we rely on the path we constructed.
    // The success (result=0) is the main thing.
    if (resultLine.includes("result=0")) {
        return true; // Indicates success, filename needs to be inferred or was exact.
    }
    return null;
}


async function main() {
  try {
    // 1. Read AGI environment variables
    // Asterisk sends variables like agi_request, agi_channel, agi_language, etc.
    // and any variables passed as arguments to AGI() in extensions.conf
    // For this script, we expect: callId, callerIdNum, language, unique_filename_base
    // These would be passed like: AGI(script.js,callId,callerIdNum,language,filename_base)

    // Read all initial AGI variables
    let line;
    while ((line = await new Promise(resolve => rl.once('line', resolve))) && line.trim() !== '') {
      const [key, value] = line.split(':').map(s => s.trim());
      agiVariables[key] = value;
      // console.error(`AGI VAR: ${key} = ${value}`); // Log to stderr for debugging
    }

    // console.error("AGI Variables Received:", agiVariables);

    const callId = agiVariables['agi_arg_1'] || agiVariables['agi_uniqueid']; // Prefer passed callId
    const channel = agiVariables['agi_channel'];
    const language = agiVariables['agi_arg_2'] || agiVariables['agi_language'] || 'en';
    // Use a base filename passed from dialplan or generate one
    const recordingFileBase = agiVariables['agi_arg_3'] || `${callId}_utterance_${Date.now()}`;
    const recordingFormat = 'wav';
    const finalRecordFileName = `${recordingFileBase}.${recordingFormat}`;
    const fullRecordPath = path.join(AGI_RECORDING_PATH_PREFIX, finalRecordFileName);

    if (!callId || !channel) {
      console.error("AGI Error: Missing callId or channel information.");
      await sendCommand('HANGUP'); // Or some other error indication
      process.exit(1);
    }

    // Ensure directory exists (Node.js script running on same machine as Asterisk)
    try {
        await fs.promises.mkdir(AGI_RECORDING_PATH_PREFIX, { recursive: true });
    } catch (dirError) {
        console.error(`AGI Error: Failed to create recording directory ${AGI_RECORDING_PATH_PREFIX}: ${dirError.message}`);
        await sendCommand('STREAM FILE error "An error occurred, please try again later"');
        await sendCommand('HANGUP');
        process.exit(1);
    }


    // 2. Play a beep (optional)
    // await sendCommand('STREAM FILE beep ""'); // Assumes 'beep.gsm' or similar is in sounds dir
    await sendCommand('EXEC Playback "beep"'); // Simpler way to play a standard beep

    // 3. Record audio
    const recordTimeoutMs = parseInt(agiVariables['agi_arg_4'] || process.env.CUSTOMER_UTTERANCE_DURATION_MS || "7000");
    const maxSilenceSec = parseInt(agiVariables['agi_arg_5'] || process.env.MAX_SILENCE_SECONDS || "3");
    const escapeDigits = '#'; // User can press # to stop recording

    // AGI RECORD FILE <filename> <format> <escape_digits> <timeout_ms> [offset_samples] [BEEP] [s=<silence_seconds>]
    // Note: Asterisk's RECORD FILE saves to its configured astspooldir + filename if not absolute.
    // Providing an absolute path is safer if permissions allow.
    const recordCommand = `RECORD FILE "${fullRecordPath}" ${recordingFormat} ${escapeDigits} ${recordTimeoutMs} 0 BEEP s=${maxSilenceSec}`;
    // console.error(`AGI: Executing: ${recordCommand}`);

    const recordResult = await sendCommand(recordCommand);
    // console.error(`AGI: Record result: ${recordResult}`);

    // Check if recording was successful (result=0 means success)
    // The actual filename might be returned in parentheses like (filename=/path/to/file.wav)
    // or it might just be result=0. We'll assume fullRecordPath is correct if successful.
    const parseResult = parseRecordFileResult(recordResult);
    let recordedFilePath = fullRecordPath; // Assume this path if not explicitly returned differently

    if (recordResult.startsWith("200 result=0")) {
        if (typeof parseResult === 'string' && parseResult) { // If filename was in response
            recordedFilePath = parseResult;
            // console.error(`AGI: Recording successful, file: ${recordedFilePath}`);
        } else {
            // console.error(`AGI: Recording successful (result=0), using constructed path: ${recordedFilePath}`);
        }
        // Verify file exists, just in case
        try {
            await fs.promises.access(recordedFilePath);
        } catch (fileAccessError) {
            console.error(`AGI Error: Recorded file ${recordedFilePath} not found after Record command.`);
            throw new Error('Recorded file not found post-recording.');
        }
    } else {
      console.error(`AGI Error: Recording failed. Result: ${recordResult}`);
      throw new Error('Recording failed as per AGI response.');
    }


    // 4. Notify the backend application
    const postData = querystring.stringify({
      callId: callId,
      audioFilePath: recordedFilePath, // Send the path of the recorded file
      channel: channel, // Send channel for context if needed
      language: language
    });

    const httpOptions = {
      hostname: (new URL(NOTIFY_URL)).hostname,
      port: (new URL(NOTIFY_URL)).port || 80,
      path: (new URL(NOTIFY_URL)).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // console.error(`AGI: Notifying backend at ${NOTIFY_URL} with data: ${postData}`);

    await new Promise((resolveHttpRequest, rejectHttpRequest) => {
      const req = http.request(httpOptions, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // console.error(`AGI: Backend notified successfully. Response: ${responseBody}`);
            resolveHttpRequest(responseBody);
          } else {
            // console.error(`AGI Error: Backend notification failed. Status: ${res.statusCode}, Body: ${responseBody}`);
            rejectHttpRequest(new Error(`Backend notification failed with status ${res.statusCode}`));
          }
        });
      });
      req.on('error', (e) => {
        // console.error(`AGI Error: Problem with backend notification request: ${e.message}`);
        rejectHttpRequest(e);
      });
      req.write(postData);
      req.end();
    });

    // Optional: Play a "thank you" or "processing" message
    // await sendCommand('STREAM FILE "your-call-is-being-processed" ""');

  } catch (error) {
    // Log errors to Asterisk console (stderr for AGI scripts)
    console.error(`AGI Script Error: ${error.message}`);
    // Try to inform the user if possible, then hang up
    try {
        await sendCommand('STREAM FILE "error" ""'); // Play a generic error sound
    } catch (e) {
        // ignore
    }
  } finally {
    // AGI script should gracefully exit. Asterisk handles channel hangup based on dialplan.
    // If the AGI script is the last thing in the dialplan for this call, Asterisk might hang up.
    // Or, we can explicitly hangup if an unrecoverable error occurred.
    // For now, let the dialplan decide or the main app handle hangup via AMI.
    // console.error("AGI Script: Exiting.");
    process.exit(0);
  }
}

// Start processing AGI commands
main();
