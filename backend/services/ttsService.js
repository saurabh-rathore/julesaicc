const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cuid = require('cuid'); // For unique filenames
require('dotenv').config();
const amiService = require('./amiService'); // To play audio via AMI

const COQUI_TTS_URL = process.env.COQUI_TTS_URL; // e.g., http://localhost:5002/api/tts
const TTS_AUDIO_PATH = process.env.TTS_AUDIO_PATH || '/tmp/tts_audio'; // Path to store temporary TTS audio files

/**
 * Ensures the TTS audio directory exists.
 */
const ensureTtsAudioPathExists = async () => {
  try {
    await fs.promises.mkdir(TTS_AUDIO_PATH, { recursive: true });
    console.log(`TTS Service: TTS audio path ${TTS_AUDIO_PATH} ensured.`);
  } catch (error) {
    console.error(`TTS Service: Error creating TTS audio directory ${TTS_AUDIO_PATH}:`, error);
    throw error;
  }
};

/**
 * Generates speech from text using Coqui TTS API and saves it to a file.
 * @param {string} textToSpeak - The text to convert to speech.
 * @param {string} callId - Call ID for context/logging, used in filename.
 * @param {string} [language='en'] - Language for TTS.
 * @param {string} [speakerId] - Optional speaker ID for Coqui TTS if using multi-speaker models.
 * @returns {Promise<string>} The full path to the generated audio file.
 */
const textToSpeech = async (textToSpeak, callId, language = 'en', speakerId = null) => {
  if (!COQUI_TTS_URL) {
    console.error('TTS Service Error: COQUI_TTS_URL is not defined in .env file.');
    throw new Error('TTS service is not configured.');
  }
  if (!textToSpeak) {
    throw new Error('Text to speak cannot be empty.');
  }

  await ensureTtsAudioPathExists();

  const fileName = `tts_output_${callId}_${cuid()}.wav`; // Unique filename
  const filePath = path.join(TTS_AUDIO_PATH, fileName);

  const params = new URLSearchParams();
  params.append('text', textToSpeak);
  params.append('language_id', language); // Coqui Studio TTS uses language_id
  if (speakerId) {
    params.append('speaker_id', speakerId); // For multi-speaker models
  }
  // Add other Coqui TTS specific parameters as needed, e.g., voice_id for older API versions

  console.log(`TTS Service: Requesting speech for text: "${textToSpeak}" from ${COQUI_TTS_URL}`);

  try {
    const response = await axios({
      method: 'GET', // Coqui TTS API /api/tts is usually GET with query params
      url: COQUI_TTS_URL,
      params: params,
      responseType: 'stream', // Important for handling audio data
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`TTS Service: Audio file saved to ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', (err) => {
        console.error('TTS Service: Error writing audio file:', err);
        fs.unlink(filePath, () => {}); // Attempt to delete partial file
        reject(new Error(`Failed to write TTS audio file: ${err.message}`));
      });
      response.data.on('error', (err) => {
        console.error('TTS Service: Error in TTS response stream:', err);
        reject(new Error(`TTS response stream error: ${err.message}`));
      })
    });
  } catch (error) {
    if (error.response) {
      console.error('TTS Service Error: Response from Coqui TTS API:', error.response.status, error.response.data);
      // Attempt to read error details if response is JSON
      let errorDetail = '';
      if (error.response.data && typeof error.response.data.pipe !== 'function') { // Check it's not a stream itself
        try {
            errorDetail = Buffer.isBuffer(error.response.data) ? error.response.data.toString() : JSON.stringify(error.response.data);
        } catch (e) {
            errorDetail = 'Could not parse error response body.';
        }
      }
      throw new Error(`Coqui TTS API Error: ${error.response.status} - ${errorDetail || error.message}`);
    } else if (error.request) {
      console.error('TTS Service Error: No response received from Coqui TTS API:', error.request);
      throw new Error('Coqui TTS API Error: No response received.');
    } else {
      console.error('TTS Service Error: Error in Coqui TTS request setup:', error.message);
      throw new Error(`Coqui TTS Request Setup Error: ${error.message}`);
    }
  }
};

/**
 * Plays an audio file on a given Asterisk channel.
 * @param {string} channel - The Asterisk channel to play the audio on.
 * @param {string} audioFilePath - The full path to the audio file.
 * @returns {Promise<object>} The AMI response.
 */
const playAudioOnChannel = async (channel, audioFilePath) => {
  if (!channel || !audioFilePath) {
    throw new Error('Channel and audio file path are required to play audio.');
  }

  // Asterisk's Playback application needs the filename without the extension,
  // and it searches in Asterisk's sound paths.
  // For arbitrary paths, 'StreamFile' might be better if the file is accessible by Asterisk
  // or if we use AGI to stream.
  // However, Playback can also play full paths if specified correctly, depending on Asterisk version/config.
  // Let's try with full path first, assuming Asterisk can access it.
  // The path needs to be accessible by the Asterisk process.
  // A common approach is to place files in /var/lib/asterisk/sounds/custom or similar.
  // For now, we'll assume the TTS_AUDIO_PATH is accessible or we adjust later.

  // Remove .wav extension for Playback command if it's standard behavior
  const playbackFile = audioFilePath.endsWith('.wav') ? audioFilePath.slice(0, -4) : audioFilePath;

  const action = {
    action: 'Playback',
    channel: channel,
    application: 'Playback', // This is redundant, action is Playback
    data: playbackFile, // File path without extension for Playback
    // For StreamFile, it would be:
    // action: 'StreamFile',
    // channel: channel,
    // application: 'StreamFile',
    // data: `${audioFilePath},#,0,3,0` // Example data for StreamFile
  };

  // Alternative using StreamFile which might be more robust for arbitrary paths if Asterisk can access them
  // const streamFileAction = {
  //   action: 'AGI',
  //   channel: channel,
  //   command: `STREAM FILE ${audioFilePath} "#"`, // Use # as escape digits
  //   // Or use Originate with Application Playback if more control is needed
  // };
  // For now, sticking with Playback action via AMI.

  console.log(`TTS Service: Playing audio ${playbackFile} on channel ${channel}`);
  try {
    // Ensure the file exists before trying to play
    await fs.promises.access(audioFilePath);
    const response = await amiService.sendAction(action);
    if (response.response === 'Success' || response.message.includes('Playback queued')) {
      console.log(`TTS Service: Playback started successfully on channel ${channel}.`);
      return response;
    } else {
      console.error('TTS Service: Failed to start playback via AMI:', response);
      throw new Error(`AMI Playback command failed: ${response.message}`);
    }
  } catch (error) {
    console.error(`TTS Service: Error sending Playback command for ${audioFilePath} on ${channel}:`, error);
    throw error;
  }
};

/**
 * Speaks a text message on a given Asterisk channel.
 * Generates TTS audio and then plays it.
 * @param {string} channel - The Asterisk channel.
 * @param {string} textToSpeak - The text to speak.
 * @param {string} callId - The call ID for naming temporary files.
 * @param {string} [language='en'] - Language for TTS.
 * @param {string} [speakerId] - Optional speaker ID.
 * @returns {Promise<void>}
 */
const speakOnChannel = async (channel, textToSpeak, callId, language = 'en', speakerId = null) => {
  let audioFilePath = null;
  try {
    audioFilePath = await textToSpeech(textToSpeak, callId, language, speakerId);
    await playAudioOnChannel(channel, audioFilePath);
    console.log(`TTS Service: Successfully initiated speech for "${textToSpeak}" on channel ${channel}`);
  } catch (error) {
    console.error(`TTS Service: Failed to speak on channel ${channel}:`, error);
    throw error; // Re-throw for higher-level handling
  } finally {
    // Clean up the temporary audio file
    if (audioFilePath) {
      fs.unlink(audioFilePath, (err) => {
        if (err) console.error(`TTS Service: Error deleting temporary TTS file ${audioFilePath}:`, err);
        else console.log(`TTS Service: Deleted temporary TTS file ${audioFilePath}`);
      });
    }
  }
};

module.exports = {
  textToSpeech,
  playAudioOnChannel,
  speakOnChannel,
  ensureTtsAudioPathExists,
};

// Initialize by ensuring TTS audio path exists when module is loaded
ensureTtsAudioPathExists().catch(err => {
    console.error("TTS Service: Failed to initialize TTS audio path on load.", err);
});
