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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const callData = req.body;
    // user_id could be added from req.user if we track who manually created a log
    // callData.created_by_user_id = req.user.id;
    const newCall = await callService.createCall(callData);
    res.status(201).json(newCall);
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
    const errors = validationResult(req); // For query and param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const { page, limit, status, startDate, endDate, sortBy, order } = req.query;
    const filterOptions = { status, startDate, endDate };
    // Ensure page and limit are numbers if provided, or use defaults from service
    const paginationOptions = {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      sortBy,
      order
    };
    const callsData = await callService.getAllCalls(filterOptions, paginationOptions);
    res.json(callsData);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const callId = req.params.id;
    const call = await callService.getCallById(callId);
    if (!call) {
      return res.status(404).json({ message: 'Call log not found' });
    }
    res.json(call);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const callId = req.params.id;
    const updates = req.body;
    const updatedCall = await callService.updateCall(callId, updates);
    if (!updatedCall) {
      // This could mean not found, or no changes were made that affected rows.
      // callService.updateCall might return null if not found.
      // If it returns the object or null, this check is fine.
      // If it throws an error for "not found", that would be caught by the catch block.
      return res.status(404).json({ message: 'Call log not found or no update performed (e.g. data was the same).' });
    }
    res.json(updatedCall);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const callId = req.params.id;
    // Check if call exists first, or let service handle it.
    // For consistency, often good to check if parent resource exists.
    const callExists = await callService.getCallById(callId); // This also fetches transcripts if design is consistent
    if (!callExists) {
      return res.status(404).json({ message: 'Call log not found, cannot fetch transcripts.' });
    }
    // If getCallById already includes transcripts, we can return callExists.transcripts
    // If getTranscriptsForCall is a separate optimized query:
    const transcripts = await callService.getTranscriptsForCall(callId);
    res.json(transcripts);
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
