const { promisePool } = require('../config/db');
const cuid = require('cuid');

/**
 * Creates new feedback for a call.
 * @param {object} feedbackData - Data for the feedback.
 * Required: call_id, rating. Optional: comments, customer_expressed_satisfaction.
 * @returns {Promise<object>} The newly created feedback object.
 */
const createFeedback = async (feedbackData) => {
  const {
    call_id,
    rating,
    comments,
    customer_expressed_satisfaction,
    // user_id, // Could be the ID of the admin/agent submitting feedback
  } = feedbackData;

  if (!call_id || rating === undefined || rating === null) {
    throw new Error('Call ID and rating are required for feedback.');
  }
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    // Assuming a 1-5 rating scale
    throw new Error('Rating must be a number between 1 and 5.');
  }

  const feedbackId = cuid();
  const newFeedback = {
    id: feedbackId,
    call_id,
    rating,
    comments: comments || null,
    customer_expressed_satisfaction: customer_expressed_satisfaction !== undefined ? customer_expressed_satisfaction : null,
    // collected_at will be handled by MySQL
  };

  try {
    // Check if feedback for this call_id already exists, as per unique key constraint
    const [existingFeedback] = await promisePool.query('SELECT id FROM feedback WHERE call_id = ?', [call_id]);
    if (existingFeedback.length > 0) {
      // Option 1: Throw error
      // throw new Error(`Feedback for call ID ${call_id} already exists.`);
      // Option 2: Update existing feedback (more user-friendly for UIs)
      console.warn(`FeedbackService: Feedback for call ID ${call_id} already exists. Updating instead.`);
      delete newFeedback.id; // Don't try to update the ID
      delete newFeedback.call_id; // Don't update call_id in an update scenario based on call_id
      const [updateResult] = await promisePool.query('UPDATE feedback SET ? WHERE call_id = ?', [newFeedback, call_id]);
      if (updateResult.affectedRows === 0) {
          throw new Error('Failed to update existing feedback.');
      }
      return { id: existingFeedback[0].id, call_id, ...newFeedback};

    } else {
      // Create new feedback
      const [result] = await promisePool.query('INSERT INTO feedback SET ?', newFeedback);
      if (result.affectedRows === 1) {
        return { id: feedbackId, ...newFeedback };
      } else {
        throw new Error('Failed to create feedback, no rows affected.');
      }
    }
  } catch (error) {
    console.error(`FeedbackService: Error creating/updating feedback for call_id ${call_id} in DB: ${error.message}`);
    throw error;
  }
};

/**
 * Retrieves feedback for a specific call.
 * @param {string} callId - The ID of the call.
 * @returns {Promise<object|null>} The feedback object if found, otherwise null.
 */
const getFeedbackByCallId = async (callId) => {
  if (!callId) {
    throw new Error('Call ID is required to fetch feedback.');
  }
  try {
    const [rows] = await promisePool.query('SELECT * FROM feedback WHERE call_id = ?', [callId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`FeedbackService: Error fetching feedback for call ID ${callId}:`, error.message);
    throw error;
  }
};

/**
 * Retrieves all feedback entries (potentially with pagination for admin views).
 * For now, a simple retrieval of all feedback.
 * @returns {Promise<Array>} An array of feedback objects.
 */
const getAllFeedback = async (/* paginationOptions = {} */) => {
    // TODO: Implement pagination similar to callService.getAllCalls if needed
    try {
        const [rows] = await promisePool.query('SELECT * FROM feedback ORDER BY collected_at DESC');
        return rows;
    } catch (error) {
        console.error(`FeedbackService: Error fetching all feedback:`, error.message);
        throw error;
    }
};


module.exports = {
  createFeedback,
  getFeedbackByCallId,
  getAllFeedback,
};
