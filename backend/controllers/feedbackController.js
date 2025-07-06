const feedbackService = require('../services/feedbackService');
const { validationResult } = require('express-validator');

// @desc    Create or Update feedback for a call
// @route   POST /api/feedback
// @access  Private (e.g., Admin or Agent)
const submitFeedback = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { call_id, rating, comments, customer_expressed_satisfaction } = req.body;
  // const userId = req.user.id; // ID of the user submitting feedback (if needed)

  try {
    const feedbackData = {
      call_id,
      rating,
      comments,
      customer_expressed_satisfaction,
      // user_id: userId // if you store who submitted it
    };
    const feedback = await feedbackService.createFeedback(feedbackData);
    res.status(201).json(feedback);
  } catch (error) {
    console.error(`FeedbackController: Error submitting feedback for call ${call_id}:`, error.message);
    if (error.message.includes('required')) {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error while submitting feedback.' });
  }
};

// @desc    Get feedback for a specific call
// @route   GET /api/feedback/call/:callId
// @access  Private
const getFeedbackForCall = async (req, res) => {
  const { callId } = req.params;
  try {
    const feedback = await feedbackService.getFeedbackByCallId(callId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found for this call.' });
    }
    res.json(feedback);
  } catch (error) {
    console.error(`FeedbackController: Error fetching feedback for call ${callId}:`, error.message);
    res.status(500).json({ message: 'Server error while fetching feedback.' });
  }
};

// @desc    Get all feedback entries
// @route   GET /api/feedback
// @access  Private (Admin)
const getAllFeedbackEntries = async (req, res) => {
  try {
    // TODO: Add pagination parameters from req.query if implementing pagination in service
    const allFeedback = await feedbackService.getAllFeedback();
    res.json(allFeedback);
  } catch (error) {
    console.error('FeedbackController: Error fetching all feedback entries:', error.message);
    res.status(500).json({ message: 'Server error while fetching all feedback.' });
  }
};

module.exports = {
  submitFeedback,
  getFeedbackForCall,
  getAllFeedbackEntries,
};
