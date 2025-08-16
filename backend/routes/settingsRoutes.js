const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET /api/settings/nlu-mode
// @desc    Get the current NLU mode setting
// @access  Private
router.get('/nlu-mode', authMiddleware, settingsController.getNluMode);

// @route   POST /api/settings/nlu-mode
// @desc    Set the NLU mode
// @access  Private
router.post('/nlu-mode', authMiddleware, settingsController.setNluMode);

module.exports = router;
