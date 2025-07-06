const { promisePool } = require('../config/db');

/**
 * Finds a customer's plan details by their identifier (e.g., phone number).
 * @param {string} customerIdentifier - The customer's identifier (e.g., phone number).
 * @returns {Promise<Object|null>} The customer plan object if found, otherwise null.
 */
const findCustomerPlanByIdentifier = async (customerIdentifier) => {
  if (!customerIdentifier) {
    // console.warn('CustomerPlanService: customerIdentifier is required to find a plan.');
    return null; // Or throw new Error('Customer identifier is required.');
  }

  try {
    const [rows] = await promisePool.query(
      'SELECT id, customer_identifier, plan_name, plan_details, is_active FROM customer_plans WHERE customer_identifier = ? AND is_active = TRUE',
      [customerIdentifier]
    );

    if (rows.length > 0) {
      const plan = rows[0];
      // plan_details might be stored as JSON string, parse if necessary
      if (typeof plan.plan_details === 'string') {
        try {
          plan.plan_details = JSON.parse(plan.plan_details);
        } catch (e) {
          console.error(`CustomerPlanService: Failed to parse plan_details JSON for customer ${customerIdentifier}:`, e);
          // Decide how to handle: return as string, or nullify, or return error
          plan.plan_details = {}; // Default to empty object on parse error
        }
      }
      return plan;
    } else {
      return null; // No active plan found for this identifier
    }
  } catch (error) {
    console.error(`CustomerPlanService: Error finding customer plan by identifier ${customerIdentifier}:`, error.message);
    throw error; // Re-throw for higher-level handling
  }
};

/**
 * (Optional) Creates a new customer plan.
 * Useful for seeding data or if plans are managed via API.
 * @param {object} planData - Data for the new plan.
 * @returns {Promise<object>} The created plan object.
 */
const createCustomerPlan = async (planData) => {
    const { customer_identifier, plan_name, plan_details, is_active = true } = planData;
    if (!customer_identifier || !plan_name) {
        throw new Error('Customer identifier and plan name are required.');
    }

    const planId = require('cuid')(); // Generate CUID for the plan record itself

    const newPlan = {
        id: planId,
        customer_identifier,
        plan_name,
        plan_details: typeof plan_details === 'string' ? plan_details : JSON.stringify(plan_details || {}),
        is_active
    };

    try {
        await promisePool.query('INSERT INTO customer_plans SET ?', newPlan);
        return { id: planId, ...planData, plan_details: plan_details || {} };
    } catch (error) {
        console.error(`CustomerPlanService: Error creating customer plan for ${customer_identifier}:`, error.message);
        throw error;
    }
};


module.exports = {
  findCustomerPlanByIdentifier,
  createCustomerPlan, // Optional: if needed for setup/management
};
