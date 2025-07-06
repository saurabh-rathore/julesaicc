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
 * @returns {Promise<string>} The path to the recorded audio file.
 */
const startRecording = async (channel, callId) => {
  await ensureRecordingPathExists();
  // Filename: callId_timestamp.wav (or .gsm, .ulaw etc. depending on Asterisk config)
  // Asterisk's Monitor command typically names files based on uniqueid and timestamp.
  // We'll use callId to make it easier to associate.
  // The format 'wav' is common, but Asterisk might record in others (gsm, ulaw, etc.)
  // Whisper prefers wav, mp3, m4a, etc. Conversion might be needed.
  // For now, let's assume Asterisk produces a compatible format or we handle conversion later.

  // Using uniqueid from Asterisk channel might be more direct if callId is not the channel's uniqueid
  const recordingFileBaseName = `${callId}_${Date.now()}`;
  const recordingFileName = `${recordingFileBaseName}.wav`; // Desired format for Whisper
  const fullRecordingPath = path.join(RECORDING_PATH, recordingFileName);

  // The 'Monitor' action usually takes file format as the second parameter,
  // and filename as the third. Mixing can be done with 'm' option.
  // Format: wav, File: /path/to/file (without extension, Asterisk adds it)
  // Options: m (mix) b (bridge)
  const action = {
    action: 'Monitor',
    channel: channel,
    file: path.join(RECORDING_PATH, recordingFileBaseName), // Asterisk will append .wav or other format
    format: 'wav', // Specify wav format if possible
    mix: 'true', // Mix both legs of the call into one file
  };

  console.log(`STT Service: Starting recording for channel ${channel}, file base: ${recordingFileBaseName}`);
  try {
    const response = await amiService.sendAction(action);
    if (response.response === 'Success') {
      console.log(`STT Service: Recording started successfully for channel ${channel}. File will be ~${fullRecordingPath}`);
      // Note: Monitor command starts recording. We'll need a way to stop it or know when it's done (e.g., on Hangup event).
      // The actual filename might slightly differ (e.g., with -in/-out suffixes if not mixed properly).
      // We will assume for now it creates a single mixed file or we handle the specific output later.
      return fullRecordingPath; // This is the *intended* path, actual might vary slightly.
    } else {
      console.error('STT Service: Failed to start recording via AMI:', response);
      throw new Error(`AMI Monitor command failed: ${response.message}`);
    }
  } catch (error) {
    console.error(`STT Service: Error sending Monitor command to AMI for channel ${channel}:`, error);
    throw error;
  }
};

/**
 * Stops recording a channel.
 * @param {string} channel - The channel to stop recording.
 * @returns {Promise<void>}
 */
const stopRecording = async (channel) => {
  const action = {
    action: 'StopMonitor',
    channel: channel,
  };
  console.log(`STT Service: Attempting to stop recording for channel ${channel}`);
  try {
    const response = await amiService.sendAction(action);
    if (response.response === 'Success') {
      console.log(`STT Service: Recording stopped successfully for channel ${channel}.`);
    } else {
      // It's not always an error if StopMonitor fails (e.g., if already stopped or no monitor active)
      console.warn(`STT Service: StopMonitor command for channel ${channel} reported: ${response.message}`);
    }
  } catch (error) {
    console.error(`STT Service: Error sending StopMonitor command to AMI for channel ${channel}:`, error);
    // Don't necessarily throw here, as the call might have hung up already.
  }
};


/**
 * Transcribes an audio file using Whisper CLI.
 * @param {string} audioFilePath - Full path to the audio file.
 * @param {string} [language='en'] - Target language for transcription (e.g., 'en', 'es').
 * @returns {Promise<object>} The ASR result object (Whisper JSON output).
 */
const transcribeAudio = async (audioFilePath, language = 'en') => {
  if (!audioFilePath) {
    throw new Error('Audio file path is required for transcription.');
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
