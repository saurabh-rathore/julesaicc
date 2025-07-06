// const callService = require('../services/callService');
// const { validationResult } = require('express-validator');

// @desc    Create a new call log (manual for now, or for specific events)
// @route   POST /api/calls
// @access  Private
const createCallLog = async (req, res) => {
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   return res.status(400).json({ errors: errors.array() });
  // }
  try {
    // const callData = req.body; // e.g., { customer_phone_number, status, direction, ... }
    // callData.user_id = req.user.id; // Assuming admin/agent ID associated with logging if manual
    // const newCall = await callService.createCall(callData);
    // res.status(201).json(newCall);
    res.status(501).json({ message: 'createCallLog not implemented yet' });
  } catch (error) {
    console.error('Error creating call log:', error.message);
    res.status(500).json({ message: 'Server error while creating call log' });
  }
};

// @desc    Get all call logs (with pagination and filtering)
// @route   GET /api/calls
// @access  Private
const getCallLogs = async (req, res) => {
  try {
    // const { page = 1, limit = 10, status, startDate, endDate, sortBy = 'start_time', order = 'DESC' } = req.query;
    // const filterOptions = { status, startDate, endDate };
    // const paginationOptions = { page: parseInt(page), limit: parseInt(limit), sortBy, order };
    // const calls = await callService.getAllCalls(filterOptions, paginationOptions);
    // res.json(calls);
    res.status(501).json({ message: 'getCallLogs not implemented yet' });
  } catch (error) {
    console.error('Error fetching call logs:', error.message);
    res.status(500).json({ message: 'Server error while fetching call logs' });
  }
};

// @desc    Get a single call log by ID, including transcripts
// @route   GET /api/calls/:id
// @access  Private
const getCallLogById = async (req, res) => {
  try {
    // const callId = req.params.id;
    // const call = await callService.getCallById(callId);
    // if (!call) {
    //   return res.status(404).json({ message: 'Call log not found' });
    // }
    // res.json(call);
    res.status(501).json({ message: `getCallLogById for ${req.params.id} not implemented yet` });
  } catch (error) {
    console.error(`Error fetching call log ${req.params.id}:`, error.message);
    res.status(500).json({ message: 'Server error while fetching call log details' });
  }
};

// @desc    Update a call log (e.g., status, disposition)
// @route   PUT /api/calls/:id
// @access  Private
const updateCallLog = async (req, res) => {
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   return res.status(400).json({ errors: errors.array() });
  // }
  try {
    // const callId = req.params.id;
    // const updates = req.body;
    // const updatedCall = await callService.updateCall(callId, updates);
    // if (!updatedCall) {
    //   return res.status(404).json({ message: 'Call log not found or not updated' });
    // }
    // res.json(updatedCall);
    res.status(501).json({ message: `updateCallLog for ${req.params.id} not implemented yet` });
  } catch (error) {
    console.error(`Error updating call log ${req.params.id}:`, error.message);
    res.status(500).json({ message: 'Server error while updating call log' });
  }
};

// @desc    Get transcripts for a specific call
// @route   GET /api/calls/:id/transcripts
// @access  Private
const getCallTranscripts = async (req, res) => {
    try {
        // const callId = req.params.id;
        // const transcripts = await callService.getTranscriptsForCall(callId);
        // res.json(transcripts);
        res.status(501).json({ message: `getCallTranscripts for ${req.params.id} not implemented yet` });
    } catch (error) {
        console.error(`Error fetching transcripts for call ${req.params.id}:`, error.message);
        res.status(500).json({ message: 'Server error while fetching call transcripts' });
    }
};


module.exports = {
  createCallLog,
  getCallLogs,
  getCallLogById,
  updateCallLog,
  getCallTranscripts,
};
