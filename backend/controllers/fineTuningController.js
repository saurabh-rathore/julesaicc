const fineTuningService = require('../services/fineTuningService');

const startFineTuning = async (req, res) => {
  try {
    const { model } = req.body;
    const result = await fineTuningService.startFineTuning(model);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startFineTuning,
};
