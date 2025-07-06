const { promisePool } = require('../config/db');

// This service will contain the logic to query the database for analytics data.

/**
 * Fetches overall call statistics.
 * - Total calls (completed or handled by AI/human, excluding mere initiated/failed without interaction)
 * - Average call duration for completed/handled calls.
 * - Total number of escalations.
 */
const fetchCallStats = async () => {
  try {
    const [rows] = await promisePool.query(`
      SELECT
        COUNT(*) AS totalCalls,
        AVG(CASE WHEN status IN ('completed', 'answered_ai', 'answered_human', 'in_progress_ai', 'in_progress_human', 'escalated') AND start_time IS NOT NULL AND end_time IS NOT NULL THEN TIMESTAMPDIFF(SECOND, start_time, end_time) ELSE NULL END) AS averageDurationSeconds,
        SUM(CASE WHEN status = 'escalated' OR final_disposition LIKE '%escalat%' THEN 1 ELSE 0 END) AS totalEscalations
      FROM calls
      WHERE status NOT IN ('initiated', 'ringing', 'failed');
      -- Consider only calls that were at least answered or processed.
      -- 'failed' might mean technical failure before connection.
    `);

    const stats = rows[0];
    return {
      totalCalls: stats.totalCalls || 0,
      averageDurationSeconds: stats.averageDurationSeconds ? parseFloat(stats.averageDurationSeconds.toFixed(2)) : 0,
      totalEscalations: stats.totalEscalations || 0,
    };
  } catch (error) {
    console.error('AnalyticsService: Error fetching call stats:', error);
    throw error;
  }
};

/**
 * Fetches AI vs Human resolution rates.
 * Resolution is based on 'final_disposition' containing 'resolved' and status being 'completed'.
 * AI resolved: completed by AI (escalated_to_agent_id is NULL).
 * Human resolved: completed after escalation (escalated_to_agent_id IS NOT NULL).
 */
const fetchResolutionRates = async () => {
  try {
    const [rows] = await promisePool.query(`
      SELECT
        SUM(CASE WHEN final_disposition LIKE '%resolved%' AND status = 'completed' AND escalated_to_agent_id IS NULL THEN 1 ELSE 0 END) AS aiResolvedCount,
        SUM(CASE WHEN final_disposition LIKE '%resolved%' AND status = 'completed' AND escalated_to_agent_id IS NOT NULL THEN 1 ELSE 0 END) AS humanResolvedCount,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalatedCount,
        COUNT(CASE WHEN status = 'completed' OR status = 'escalated' THEN 1 ELSE NULL END) AS totalRelevantCallsForResolutionRate
      FROM calls
      WHERE status IN ('completed', 'escalated');
      -- Only consider calls that were completed or escalated for resolution rates.
    `);

    const rates = rows[0];
    const totalResolvedByAiOrHuman = (rates.aiResolvedCount || 0) + (rates.humanResolvedCount || 0);

    return {
      aiResolvedCount: rates.aiResolvedCount || 0,
      humanResolvedCount: rates.humanResolvedCount || 0,
      escalatedCount: rates.escalatedCount || 0, // Total calls that were escalated at some point
      totalRelevantCallsForResolutionRate: rates.totalRelevantCallsForResolutionRate || 0,
      // Resolution rate can be calculated in frontend: (resolvedCount / totalRelevantCallsForResolutionRate) * 100
    };
  } catch (error) {
    console.error('AnalyticsService: Error fetching resolution rates:', error);
    throw error;
  }
};

/**
 * Fetches feedback summary.
 * - Average rating.
 * - Total number of feedback entries.
 */
const fetchFeedbackSummary = async () => {
  try {
    const [rows] = await promisePool.query(`
      SELECT
        AVG(rating) AS averageRating,
        COUNT(*) AS totalFeedbackEntries
      FROM feedback
      WHERE rating IS NOT NULL; -- Only consider entries where a rating was given
    `);

    const summary = rows[0];
    return {
      averageRating: summary.averageRating ? parseFloat(summary.averageRating.toFixed(2)) : 0,
      totalFeedbackEntries: summary.totalFeedbackEntries || 0,
    };
  } catch (error) {
    console.error('AnalyticsService: Error fetching feedback summary:', error);
    throw error;
  }
};

module.exports = {
  fetchCallStats,
  fetchResolutionRates,
  fetchFeedbackSummary,
};
