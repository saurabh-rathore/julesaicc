const fs = require('fs').promises;
const path = require('path');

const settingsFilePath = path.join(__dirname, '..', 'settings.json');

// Helper to read settings, providing defaults if file doesn't exist
const readSettings = async () => {
  try {
    await fs.access(settingsFilePath);
    const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
    return JSON.parse(settingsData);
  } catch (error) {
    // If file doesn't exist or is invalid, return default
    return { nluMode: 'llm' }; // Default to 'llm'
  }
};

// @desc    Get the current NLU mode
// @route   GET /api/settings/nlu-mode
// @access  Private
const getNluMode = async (req, res) => {
  try {
    const settings = await readSettings();
    res.json({ mode: settings.nluMode });
  } catch (error) {
    console.error('Error in getNluMode:', error);
    res.status(500).json({ message: 'Error reading NLU mode setting.' });
  }
};

// @desc    Set the current NLU mode
// @route   POST /api/settings/nlu-mode
// @access  Private
const setNluMode = async (req, res) => {
  const { mode } = req.body;
  if (!mode || !['llm', 'rasa'].includes(mode)) {
    return res.status(400).json({ message: "Invalid mode specified. Must be 'llm' or 'rasa'." });
  }

  try {
    let settings = await readSettings();
    settings.nluMode = mode;
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
    res.status(200).json({ message: `NLU mode set to ${mode}` });
  } catch (error) {
    console.error('Error in setNluMode:', error);
    res.status(500).json({ message: 'Error saving NLU mode setting.' });
  }
};

module.exports = {
  getNluMode,
  setNluMode,
};
