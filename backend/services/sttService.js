const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const amiService = require('./amiService'); // To send AMI commands for recording
const callService = require('./callService'); // To store transcripts
const cuid = require('cuid'); // For unique filenames if needed

// Configuration - consider moving to .env or a config file
const RECORDING_PATH = process.env.RECORDING_PATH || '/tmp/asterisk_recordings'; // Ensure this path is writable by the Node.js process
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base.en'; // Or other models like 'small', 'medium', 'large'
const WHISPER_OUTPUT_FORMAT = 'json'; // or 'txt', 'vtt', 'srt', 'tsv'

/**
 * Ensures the recording directory exists.
 */
const ensureRecordingPathExists = async () => {
  try {
    await fs.mkdir(RECORDING_PATH, { recursive: true });
    console.log(`STT Service: Recording path ${RECORDING_PATH} ensured.`);
  } catch (error) {
    console.error(`STT Service: Error creating recording directory ${RECORDING_PATH}:`, error);
    throw error; // Re-throw to prevent further operations if path cannot be created
  }
};

/**
 * Starts recording a channel using Asterisk's Monitor command.
 * @param {string} channel - The channel to record (e.g., 'SIP/somepeer-000000a1').
 * @param {string} callId - The unique ID of the call, used for naming the recording.
 * @param {number} durationMs - Duration to record in milliseconds.
 * @returns {Promise<string>} The path to the recorded audio file.
 */
const recordUtterance = async (channel, callId, durationMs = 7000) => {
  await ensureRecordingPathExists();

  const recordingFileBaseName = `${callId}_utterance_${Date.now()}`;
  // Asterisk's Record action saves the file with the specified extension.
  const recordingFileName = `${recordingFileBaseName}.wav`;
  const fullRecordingPath = path.join(RECORDING_PATH, recordingFileName);

  // Action: Record
  // File: The filename for the recording.
  // Format: The format to record in (e.g., gsm, wav, etc.).
  // Timeout: Maximum recording time in milliseconds. Use -1 for no timeout.
  // MaxSilence: Seconds of silence to allow before hanging up. Use 0 to disable.
  // Beep: Play a beep before recording (true/false or filename of beep).
  // EscapeDigits: Digits that can be pressed to terminate the recording.
  const action = {
    action: 'Record',
    channel: channel,
    file: fullRecordingPath, // Full path including extension for Record action
    format: 'wav',       // Desired format for Whisper
    timeout: durationMs.toString(),  // Max recording time in ms
    maxsilence: '3',     // Max seconds of silence before stopping (e.g., 3 seconds)
    beep: 'true',        // Play a beep
    overwrite: 'true',   // Overwrite if file exists (should be unique due to timestamp anyway)
    // escapeDigits: '#' // Example: allow user to press # to end recording
  };

  console.log(`STT Service: Starting utterance recording for channel ${channel}, file: ${recordingFileName}, duration: ${durationMs}ms`);
  try {
    const response = await amiService.sendAction(action);
    // The 'Record' action is asynchronous in Asterisk. The AMI response indicates if the action was accepted.
    // It doesn't wait for the recording to finish.
    // We need to rely on the timeout or maxsilence, or listen for specific AMI events if 'Record' generates them upon completion.
    // For simplicity here, we assume the file will be there after timeout + a small buffer.
    // A more robust solution might involve checking for file existence or an event.
    if (response.response === 'Success' || response.message.includes('started')) { // Success varies by Asterisk version
      console.log(`STT Service: Utterance recording initiated for channel ${channel}. Waiting for ${durationMs}ms.`);
      // Wait for the recording duration + a small buffer for file writing
      await new Promise(resolve => setTimeout(resolve, durationMs + 1000));

      // Check if file was created (basic check)
      try {
        await fs.access(fullRecordingPath);
        console.log(`STT Service: Recording ${fullRecordingPath} presumed complete.`);
        return fullRecordingPath;
      } catch (fileError) {
        console.error(`STT Service: Recording file ${fullRecordingPath} not found after timeout.`);
        throw new Error(`Recording file not found after timeout: ${fullRecordingPath}`);
      }
    } else {
      console.error('STT Service: Failed to initiate recording via AMI Record action:', response);
      throw new Error(`AMI Record command failed: ${response.message}`);
    }
  } catch (error) {
    console.error(`STT Service: Error sending Record command to AMI for channel ${channel}:`, error);
    throw error;
  }
};

// Monitor based recording (can be kept for full call recording if needed)
// /**
//  * Starts recording a channel using Asterisk's Monitor command.
//  * @param {string} channel - The channel to record (e.g., 'SIP/somepeer-000000a1').
//  * @param {string} callId - The unique ID of the call, used for naming the recording.
//  * @returns {Promise<string>} The path to the recorded audio file.
//  */
// const startRecording = async (channel, callId) => { ... existing startRecording code ... };
// /**
//  * Stops recording a channel.
//  * @param {string} channel - The channel to stop recording.
//  * @returns {Promise<void>}
//  */
// const stopRecording = async (channel) => { ... existing stopRecording code ... };


/**
 * Transcribes an audio file using Whisper CLI.
 * @param {string} audioFilePath - Full path to the audio file.
 * @param {string} [language='en'] - Target language for transcription (e.g., 'en', 'es').
 * @returns {Promise<object>} The ASR result object (Whisper JSON output).
 */
const transcribeAudio = async (audioFilePath, language = 'en') => {
  if (!audioFilePath) {
    return { text: '', language: language, segments: [] };
  }
  try {
    await fs.access(audioFilePath); // Check if file exists
  } catch (error) {
    console.error(`STT Service: Audio file not found at ${audioFilePath}`);
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }

  // Ensure output directory for whisper results exists if needed, or use stdout
  // If WHISPER_MODEL already implies a language (e.g., 'base.en'), the --language flag might be redundant
  // or could be used to override/specify for multilingual models (like 'large').
  const languageOption = language ? `--language ${language}` : '';
  const whisperCommand = `whisper "${audioFilePath}" --model ${WHISPER_MODEL} ${languageOption} --output_format ${WHISPER_OUTPUT_FORMAT} --output_dir "${RECORDING_PATH}"`;
  // If output_dir is used, Whisper creates files like audioFilePath.json.
  // Alternatively, to capture stdout: remove --output_dir and parse stdout.
  // For simplicity with JSON output, letting it write to file first.

  console.log(`STT Service: Executing Whisper: ${whisperCommand}`);
  try {
    const { stdout, stderr } = await execPromise(whisperCommand);
    if (stderr && !stderr.toLowerCase().includes('tensor')) { // Whisper often prints info to stderr
        // Only log actual errors, ignore benign warnings like tensor core info
        const significantStderr = stderr.split('\n').filter(line => !line.toLowerCase().includes('tensor') && line.trim() !== '').join('\n');
        if (significantStderr) {
            console.warn(`STT Service: Whisper stderr: ${significantStderr}`);
        }
    }
    console.log(`STT Service: Whisper stdout: ${stdout}`); // Whisper CLI might output progress to stdout

    const transcriptJsonPath = `${audioFilePath}.${WHISPER_OUTPUT_FORMAT}`;
    const transcriptJson = await fs.readFile(transcriptJsonPath, 'utf-8');
    await fs.unlink(transcriptJsonPath); // Clean up JSON file
    // Optionally, delete the audio file too if no longer needed: await fs.unlink(audioFilePath);

    return JSON.parse(transcriptJson);
  } catch (error) {
    console.error(`STT Service: Error during Whisper transcription for ${audioFilePath}:`, error);
    throw new Error(`Whisper transcription failed: ${error.message}`);
  }
};

/**
 * Processes a call segment: starts recording, stops recording (e.g., on VAD silence or fixed duration),
 * transcribes, and saves the transcript.
 * This is a conceptual function; actual implementation will depend on call flow management.
 * @param {string} channel - The Asterisk channel identifier.
 * @param {string} callId - The call ID for logging.
 * @param {string} speaker - Who is speaking ('customer', 'ai').
 */
const processAudioSegment = async (channel, callId, speaker) => {
  let recordingPath;
  try {
    console.log(`STT Service: Processing audio segment for call ${callId}, channel ${channel}, speaker ${speaker}`);
    recordingPath = await startRecording(channel, `${callId}_${speaker}_${Date.now()}`); // Make filename more unique for segments

    // TODO: Implement logic to determine when to stop recording.
    // This could be based on Voice Activity Detection (VAD) events from Asterisk,
    // a fixed duration, or an explicit signal from the call control logic.
    // For now, we'll assume a placeholder for stopping:
    await new Promise(resolve => setTimeout(resolve, 5000)); // Placeholder: record for 5 seconds
    await stopRecording(channel);

    // It might take a moment for the file to be fully written by Asterisk after StopMonitor
    await new Promise(resolve => setTimeout(resolve, 500));

    const transcriptionResult = await transcribeAudio(recordingPath); // Ensure this path is correct based on Monitor's actual output

    if (transcriptionResult && transcriptionResult.segments) {
      for (const segment of transcriptionResult.segments) {
        const transcriptData = {
          call_id: callId,
          speaker: speaker, // 'customer' or 'ai'
          text: segment.text.trim(),
          timestamp_start: segment.start,
          timestamp_end: segment.end,
          language: transcriptionResult.language, // Overall language detected by Whisper
          confidence_score: segment.avg_logprob ? Math.exp(segment.avg_logprob) : null, // Example, actual confidence might need different calculation
        };
        await callService.createTranscript(transcriptData); // Assuming createTranscript exists in callService
        console.log(`STT Service: Transcript segment saved for call ${callId}: "${segment.text.trim()}"`);
      }
    } else {
      console.log(`STT Service: No segments found in transcription for ${callId}`);
    }
    return transcriptionResult;
  } catch (error) {
    console.error(`STT Service: Error processing audio segment for call ${callId}:`, error);
    // Optionally, try to clean up recording file if it exists
    if (recordingPath) {
      try { await fs.unlink(recordingPath); } catch (e) { /* ignore cleanup error */ }
    }
    throw error;
  }
};


module.exports = {
  startRecording,
  stopRecording,
  transcribeAudio,
  processAudioSegment, // Conceptual, needs integration with call flow
  ensureRecordingPathExists,
};

// Initialize by ensuring recording path exists when module is loaded
ensureRecordingPathExists().catch(err => {
    console.error("STT Service: Failed to initialize recording path on load.", err);
    // Depending on severity, might want to prevent app start or handle gracefully
});
