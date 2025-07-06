// const Sentiment = require('sentiment'); // This line would work if 'sentiment' is installed

/**
 * Analyzes the sentiment of a given text.
 * Uses the 'sentiment' npm package.
 *
 * @param {string} text - The text to analyze.
 * @returns {Promise<object>} A promise that resolves to an object containing:
 *                            - score: Numerical score of the sentiment.
 *                            - comparative: Comparative score.
 *                            - positive: Array of positive words found.
 *                            - negative: Array of negative words found.
 *                            - tokens: Array of tokens.
 *                            Returns null if text is empty or analysis fails.
 */
const analyzeSentiment = async (text) => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    // console.log('SentimentAnalysisService: Input text is empty, returning neutral sentiment.');
    return {
      score: 0,
      comparative: 0,
      positive: [],
      negative: [],
      tokens: [],
      calculation: []
    };
  }

  try {
    // Dynamically import Sentiment to handle potential install issues in some environments
    // or if we want to make it truly optional. For now, assume it will be present.
    const Sentiment = require('sentiment');
    const sentimentAnalyzer = new Sentiment();
    const result = sentimentAnalyzer.analyze(text);

    // The 'sentiment' package result object typically includes:
    // - score: Calculated score
    // - comparative: Comparative score
    // - tokens: List of tokens
    // - words: List of words found in AFINN list
    // - positive: List of positive words found
    // - negative: List of negative words found
    // - calculation: Array of objects showing word contributions

    // console.log(`SentimentAnalysisService: Text: "${text.substring(0,30)}...", Score: ${result.score}, Negative: ${result.negative.join(', ')}`);
    return result;

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
        console.error("SentimentAnalysisService: The 'sentiment' package is not installed. Please run 'npm install sentiment'. Sentiment analysis will be skipped.");
        // Return a neutral-like or error structure
        return {
            score: 0,
            comparative: 0,
            positive: [],
            negative: [],
            tokens: [],
            calculation: [],
            error: "Sentiment package not found."
        };
    }
    console.error('SentimentAnalysisService: Error analyzing sentiment:', error);
    throw error; // Re-throw for higher-level handling or return a default neutral object
  }
};

module.exports = {
  analyzeSentiment,
};
