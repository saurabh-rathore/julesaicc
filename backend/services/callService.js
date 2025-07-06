const { promisePool } = require('../config/db');
const cuid = require('cuid');

/**
 * Creates a new call record in the database.
 * @param {object} callData - Data for the new call.
 * Required: status. Optional: customer_phone_number, sip_call_id, start_time, end_time, direction, etc.
 * @returns {Promise<object>} The newly created call object.
 */
const createCall = async (callData) => {
  if (!callData || !callData.status) {
    throw new Error('Call status is required to create a call log.');
  }

  const callId = cuid();
  const newCall = {
    id: callId,
    customer_phone_number: callData.customer_phone_number || null,
    sip_call_id: callData.sip_call_id || null,
    start_time: callData.start_time || new Date(), // Default to now if not provided
    end_time: callData.end_time || null,
    status: callData.status, // e.g., 'initiated', 'ringing', 'answered_ai', 'completed'
    direction: callData.direction || 'inbound',
    initial_language_preference: callData.initial_language_preference || null,
    final_disposition: callData.final_disposition || null,
    recording_url: callData.recording_url || null,
    escalated_to_agent_id: callData.escalated_to_agent_id || null,
    // created_at and updated_at will be handled by MySQL
  };

  try {
    const [result] = await promisePool.query('INSERT INTO calls SET ?', newCall);
    if (result.affectedRows === 1) {
      // Return the full call object as it is in the DB (or at least the ID and what was inserted)
      return { id: callId, ...callData, start_time: newCall.start_time }; // Return a representation
    } else {
      throw new Error('Failed to create call log, no rows affected.');
    }
  } catch (error) {
    console.error(`Error creating call log in DB: ${error.message}`);
    throw error; // Re-throw for controller to handle
  }
};

/**
 * Retrieves all calls with optional filtering and pagination.
 * @param {object} filterOptions - e.g., { status, startDate, endDate }
 * @param {object} paginationOptions - e.g., { page, limit, sortBy, order }
 * @returns {Promise<object>} Object containing calls and pagination info.
 */
const getAllCalls = async (filterOptions = {}, paginationOptions = {}) => {
  const { status, startDate, endDate } = filterOptions;
  const { page = 1, limit = 10, sortBy = 'start_time', order = 'DESC' } = paginationOptions;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM calls WHERE 1=1';
  const queryParams = [];

  if (status) {
    query += ' AND status = ?';
    queryParams.push(status);
  }
  if (startDate) {
    query += ' AND start_time >= ?';
    queryParams.push(startDate);
  }
  if (endDate) {
    query += ' AND start_time <= ?'; // Assuming endDate is the end of the day
    queryParams.push(endDate);
  }

  // Count total records for pagination
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const [totalRows] = await promisePool.query(countQuery, queryParams);
  const totalCalls = totalRows[0].total;
  const totalPages = Math.ceil(totalCalls / limit);

  // Add ordering and pagination to the main query
  const validSortColumns = ['start_time', 'end_time', 'status', 'direction']; // Whitelist sortable columns
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'start_time';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
  queryParams.push(limit, offset);

  try {
    const [calls] = await promisePool.query(query, queryParams);
    return {
      calls,
      pagination: {
        page,
        limit,
        totalPages,
        totalCalls,
      },
    };
  } catch (error) {
    console.error(`Error fetching all call logs from DB: ${error.message}`);
    throw error;
  }
};

/**
 * Retrieves a single call by its ID, along with its transcripts.
 * @param {string} callId - The ID of the call.
 * @returns {Promise<object|null>} The call object with transcripts, or null if not found.
 */
const getCallById = async (callId) => {
  if (!callId) {
    throw new Error('Call ID is required.');
  }
  try {
    const [callRows] = await promisePool.query('SELECT * FROM calls WHERE id = ?', [callId]);
    if (callRows.length === 0) {
      return null;
    }
    const call = callRows[0];

    const [transcriptRows] = await promisePool.query(
      'SELECT * FROM transcripts WHERE call_id = ? ORDER BY timestamp_start ASC',
      [callId]
    );
    call.transcripts = transcriptRows;
    return call;
  } catch (error) {
    console.error(`Error fetching call log by ID ${callId} from DB: ${error.message}`);
    throw error;
  }
};

/**
 * Updates an existing call record.
 * @param {string} callId - The ID of the call to update.
 * @param {object} updateData - An object containing fields to update.
 * @returns {Promise<object|null>} The updated call object, or null if not found/not updated.
 */
const updateCall = async (callId, updateData) => {
  if (!callId || !updateData || Object.keys(updateData).length === 0) {
    throw new Error('Call ID and update data are required.');
  }
  // Ensure 'updated_at' is managed by MySQL or add manually: updateData.updated_at = new Date();

  // Prevent updating id or created_at
  delete updateData.id;
  delete updateData.created_at;

  try {
    const [result] = await promisePool.query('UPDATE calls SET ? WHERE id = ?', [updateData, callId]);
    if (result.affectedRows === 0) {
      return null; // Call not found or no changes made that affect rows
    }
    return getCallById(callId); // Fetch and return the updated call
  } catch (error) {
    console.error(`Error updating call log ID ${callId} in DB: ${error.message}`);
    throw error;
  }
};

/**
 * Retrieves all transcripts for a specific call.
 * @param {string} callId - The ID of the call.
 * @returns {Promise<Array>} An array of transcript objects.
 */
const getTranscriptsForCall = async (callId) => {
    if (!callId) {
        throw new Error('Call ID is required to fetch transcripts.');
    }
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM transcripts WHERE call_id = ? ORDER BY timestamp_start ASC',
            [callId]
        );
        return rows;
    } catch (error) {
        console.error(`Error fetching transcripts for call ID ${callId} from DB: ${error.message}`);
        throw error;
    }
};


module.exports = {
  createCall,
  getAllCalls,
  getCallById,
  updateCall,
  getTranscriptsForCall,
};

/**
 * Creates a new transcript entry for a call.
 * @param {object} transcriptData - Data for the new transcript.
 * Required: call_id, speaker, text, timestamp_start, timestamp_end
 * Optional: language, confidence_score
 * @returns {Promise<object>} The newly created transcript object.
 */
const createTranscript = async (transcriptData) => {
  const {
    call_id,
    speaker,
    text,
    timestamp_start,
    timestamp_end,
    language,
    confidence_score,
  } = transcriptData;

  if (!call_id || !speaker || !text || timestamp_start === undefined || timestamp_end === undefined) {
    throw new Error('Missing required fields for transcript (call_id, speaker, text, timestamp_start, timestamp_end).');
  }

  const newTranscript = {
    call_id,
    speaker,
    text,
    timestamp_start,
    timestamp_end,
    language: language || null,
    confidence_score: confidence_score || null,
    // created_at will be handled by MySQL
  };

  try {
    const [result] = await promisePool.query('INSERT INTO transcripts SET ?', newTranscript);
    if (result.insertId) {
      return { id: result.insertId, ...newTranscript };
    } else {
      throw new Error('Failed to create transcript, no insertId returned.');
    }
  } catch (error) {
    console.error(`Error creating transcript for call_id ${call_id} in DB: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createCall,
  getAllCalls,
  getCallById,
  updateCall,
  getTranscriptsForCall,
  createTranscript, // Add the new function to exports
};
