const pool = require('../config/db');

/**
 * Log an action to audit_logs table
 * @param {number} user_id - The user's ID (or null for admin)
 * @param {string} user_role - 'patient', 'doctor', or 'admin'
 * @param {string} action - Human-readable action description
 * @param {string} action_type - 'login', 'logout', 'create', 'update', 'delete', 'verify', 'view'
 * @param {string} details - Additional details as JSON string
 */
async function logAction(user_id, user_role, action, action_type, details = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_role, action, action_type, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, user_role, action, action_type, details]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { logAction };
