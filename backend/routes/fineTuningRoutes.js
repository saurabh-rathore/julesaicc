const express = require('express');
const router = express.Router();
const fineTuningController = require('../controllers/fineTuningController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');

// @route   POST /api/fine-tuning/upload
// @desc    Upload a file for model fine-tuning
// @access  Private (Admin or specific role)
router.post(
  '/upload',
  authMiddleware,
  uploadMiddleware.single('trainingFile'), // 'trainingFile' is the field name in the form
  fineTuningController.handleFileUpload
);

module.exports = router;
