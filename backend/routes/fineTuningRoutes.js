const express = require('express');
const router = express.Router();
const fineTuningController = require('../controllers/fineTuningController');

router.post('/', fineTuningController.startFineTuning);

module.exports = router;
