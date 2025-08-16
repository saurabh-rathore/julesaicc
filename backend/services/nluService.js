const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const llmService = require('./llmService');

const settingsFilePath = path.join(__dirname, '..', 'settings.json');
const RASA_API_URL = process.env.RASA_API_URL; // e.g., http://localhost:5005/model/parse

// Helper to read settings
const readNluMode = async () => {
  try {
    const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
    return JSON.parse(settingsData).nluMode || 'llm';
  } catch (error) {
    // If file doesn't exist or is invalid, return default
    return 'llm';
  }
};

/**
 * Gets the NLU result from the currently configured service (LLM or Rasa).
 * @param {string} text - The user's utterance.
 * @param {string} callId - The ID of the current call.
 * @param {object} options - Additional options including conversation history.
 * @returns {Promise<object>} A structured NLU result.
 */
const getNluResult = async (text, callId, options = {}) => {
  const mode = await readNluMode();

  if (mode === 'rasa') {
    // --- RASA NLU LOGIC ---
    console.log(`NLU Service: Using Rasa for call ${callId}`);
    if (!RASA_API_URL) {
      // Mocked Rasa response for now as URL is not set
      console.log('NLU Service (Rasa): RASA_API_URL not set. Using mocked response.');
      let intent = { name: 'greet', confidence: 0.9 };
      if (text.toLowerCase().includes('agent') || text.toLowerCase().includes('escalate')) {
        intent = { name: 'request_escalation', confidence: 0.99 };
      } else if (text.toLowerCase().includes('balance')) {
        intent = { name: 'check_balance', confidence: 0.9 };
      } else if (text.toLowerCase().includes('goodbye')) {
        intent = { name: 'goodbye', confidence: 0.9 };
      }

      return Promise.resolve({
        style: 'rasa',
        intent: intent,
        entities: [], // Mocked
        originalText: text,
      });
    }

    try {
      // A real call to Rasa NLU endpoint
      const response = await axios.post(RASA_API_URL, { text: text });
      const { intent, entities } = response.data;

      return {
        style: 'rasa',
        intent: intent,
        entities: entities,
        originalText: text,
      };

    } catch (error) {
      console.error('NLU Service (Rasa): Error contacting Rasa server:', error.message);
      throw new Error('Failed to get NLU result from Rasa.');
    }

  } else {
    // --- LLM (OLD STYLE) LOGIC ---
    console.log(`NLU Service: Using LLM for call ${callId}`);
    try {
      const llmResponseText = await llmService.queryLLM(
        text,
        callId,
        options.customerIdentifier,
        { system: options.system, conversation_history: options.conversation_history }
      );
      return {
        style: 'llm',
        response: llmResponseText,
      };
    } catch (error) {
      console.error('NLU Service (LLM): Error from LLM service:', error.message);
      throw new Error('Failed to get NLU result from LLM.');
    }
  }
};

module.exports = {
  getNluResult,
};
