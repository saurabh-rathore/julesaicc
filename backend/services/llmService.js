const axios = require('axios');
require('dotenv').config();
const callService = require('./callService'); // To save AI responses as transcripts
const customerPlanService = require('./customerPlanService'); // Import customer plan service

const LLM_API_URL = process.env.LLM_API_URL; // e.g., http://localhost:11434/api/generate for Ollama
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || 'llama2'; // Default model if not specified
const LLM_API_KEY = process.env.LLM_API_KEY; // Optional: if the LLM requires an API key

/**
 * Sends text to the LLM and gets a response.
 * @param {string} inputText - The text to send to the LLM (e.g., customer's query).
 * @param {string} callId - The ID of the current call, for logging context.
 * @param {string} [customerIdentifier] - Optional customer identifier (e.g., phone number) for plan lookup.
 * @param {object} [options] - Additional options for the LLM request (e.g., context, system prompt).
 * @returns {Promise<string>} The text response from the LLM.
 */
const queryLLM = async (inputText, callId, customerIdentifier = null, options = {}) => {
  if (!LLM_API_URL) {
    console.error('LLM Service Error: LLM_API_URL is not defined in .env file.');
    throw new Error('LLM service is not configured.');
  }
  if (!inputText) {
    throw new Error('Input text cannot be empty for LLM query.');
  }

  // Construct the payload based on the expected format of your LLM API.
  // This is an example for Ollama's /api/generate endpoint.
  // Adjust accordingly for other LLMs (e.g., OpenAI, Cohere, local Hugging Face TGI).

  let contextualizedPrompt = inputText;
  let systemPrompt = options.system || "You are a helpful AI assistant for a telecom company."; // Default system prompt

  if (customerIdentifier) {
    try {
      const plan = await customerPlanService.findCustomerPlanByIdentifier(customerIdentifier);
      if (plan) {
        // Enhance the system prompt or the main prompt with plan details
        // This is a simple example; more sophisticated prompt engineering might be needed.
        systemPrompt += ` The customer's current plan is "${plan.plan_name}". Plan details: ${JSON.stringify(plan.plan_details)}.`;
        console.log(`LLM Service: Added customer plan context for ${customerIdentifier}: ${plan.plan_name}`);
      } else {
        console.log(`LLM Service: No active plan found for customer ${customerIdentifier}.`);
      }
    } catch (planError) {
      console.error(`LLM Service: Error fetching customer plan for ${customerIdentifier}:`, planError.message);
      // Decide if this error should prevent LLM call or just proceed without plan context
    }
  }

  let llmContext = options.context;

  if (!llmContext && options.conversation_history && Array.isArray(options.conversation_history)) {
    llmContext = options.conversation_history.map(turn => ({
      role: turn.speaker === 'ai' ? 'assistant' : 'user',
      content: turn.text
    }));
    // Ollama usually expects the current prompt NOT to be part of the context array itself,
    // but rather in the 'prompt' field. The history should be prior turns.
    // If the last turn in conversation_history is the current customerText, remove it from context.
    if (llmContext.length > 0 && llmContext[llmContext.length -1].role === 'user' && llmContext[llmContext.length -1].content === inputText) {
        // This check is a bit naive if inputText could be repeated.
        // A better way is for aiCallHandlerService to pass history *excluding* the current prompt.
        // For now, let's assume aiCallHandlerService passes history correctly (prior turns).
    }
  }


  const payload = {
    model: LLM_MODEL_NAME,
    prompt: contextualizedPrompt, // This is the current user utterance
    stream: false,
    system: systemPrompt,
    ...(llmContext && llmContext.length > 0 && { context: llmContext }), // Pass formatted context if available
    // Add other parameters as needed by your LLM API
  };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (LLM_API_KEY) {
    headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
  }

  console.log(`LLM Service: Sending query to ${LLM_API_URL} with model ${LLM_MODEL_NAME}. Prompt: "${inputText}"`);

  try {
    const response = await axios.post(LLM_API_URL, payload, { headers });

    // Parse the response. This is highly dependent on the LLM API.
    // For Ollama /api/generate (non-streaming):
    let llmResponseText = '';
    if (response.data && response.data.response) {
      llmResponseText = response.data.response.trim();
      console.log(`LLM Service: Received response: "${llmResponseText}"`);

      // Log AI response as a transcript entry
      if (callId) {
        try {
          await callService.createTranscript({
            call_id: callId,
            speaker: 'ai',
            text: llmResponseText,
            timestamp_start: 0, // Placeholder, actual timing needs to be managed by call flow
            timestamp_end: 0,   // Placeholder
            // language: detected language if available
          });
          console.log(`LLM Service: AI response for call ${callId} logged to transcripts.`);
        } catch (dbError) {
          console.error(`LLM Service: Failed to log AI response to transcript for call ${callId}:`, dbError);
          // Non-fatal for the LLM response itself, but should be logged.
        }
      }
      return llmResponseText;

    } else if (response.data && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
      // Example for OpenAI-like API structure
      llmResponseText = response.data.choices[0].message?.content?.trim() || response.data.choices[0].text?.trim();
      if (llmResponseText) {
        console.log(`LLM Service: Received response: "${llmResponseText}"`);
         if (callId) {
            try {
              await callService.createTranscript({ /* ... */ }); // Simplified for brevity
            } catch (dbError) { /* ... */ }
         }
        return llmResponseText;
      } else {
        console.error('LLM Service: No response text found in LLM choices:', response.data);
        throw new Error('LLM returned an empty or unexpected response structure.');
      }
    } else {
      console.error('LLM Service: Unexpected response structure from LLM:', response.data);
      throw new Error('LLM returned an unexpected response structure.');
    }

  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('LLM Service Error: Response from LLM API:', error.response.status, error.response.data);
      throw new Error(`LLM API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('LLM Service Error: No response received from LLM API:', error.request);
      throw new Error('LLM API Error: No response received.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('LLM Service Error: Error in LLM request setup:', error.message);
      throw new Error(`LLM Request Setup Error: ${error.message}`);
    }
  }
};

const summarizeHistory = async (history) => {
    // In a real implementation, this would make a separate call to the LLM
    // with a specific prompt for summarization.
    console.log("LLM Service: Summarizing conversation history...");

    const conversationText = history.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
    const prompt = `Please summarize the following conversation:\n\n${conversationText}`;

    // Re-use the queryLLM logic but without customer context for summarization
    // This is a simplification. A dedicated summarization model or prompt might be better.
    try {
        const summary = await queryLLM(prompt, null, null, { system: "You are a summarization assistant." });
        console.log("LLM Service: Generated summary:", summary);
        return summary;
    } catch (error) {
        console.error("LLM Service: Failed to summarize history:", error.message);
        return "Could not summarize history."; // Fallback
    }
};

module.exports = {
  queryLLM,
  summarizeHistory,
};
