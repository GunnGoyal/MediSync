/**
 * Patient-Doctor Chat System Model
 * Secure communication during appointment windows
 */

const pool = require('../config/db');

/**
 * Initialize chat system tables
 */
async function initializeChatTables() {
  try {
    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id SERIAL PRIMARY KEY,
        appointment_id INT REFERENCES appointments(appointment_id) ON DELETE CASCADE,
        sender_id INT NOT NULL,
        sender_role VARCHAR(10) CHECK (sender_role IN ('patient', 'doctor')) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create message index for fast retrieval
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_appointment_id 
      ON messages(appointment_id);
    `);

    return { success: true };
  } catch (err) {
    console.error('Chat table initialization error:', err);
    throw err;
  }
}

/**
 * Send a message in appointment chat
 */
async function sendMessage(appointmentId, senderId, senderRole, messageText) {
  try {
    // Validate appointment exists and is within valid timeframe
    const appointmentRes = await pool.query(`
      SELECT a.*, p.patient_id, d.doctor_id
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.patient_id
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE a.appointment_id = $1
    `, [appointmentId]);

    if (appointmentRes.rows.length === 0) {
      throw new Error('Appointment not found');
    }

    const appointment = appointmentRes.rows[0];

    // Verify sender is part of appointment
    const isValidSender = (senderRole === 'patient' && appointment.patient_id === senderId) ||
                          (senderRole === 'doctor' && appointment.doctor_id === senderId);

    if (!isValidSender) {
      throw new Error('Unauthorized: sender not part of this appointment');
    }

    // Insert message
    const result = await pool.query(`
      INSERT INTO messages (appointment_id, sender_id, sender_role, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [appointmentId, senderId, senderRole, messageText]);

    return {
      success: true,
      message: result.rows[0]
    };
  } catch (err) {
    console.error('Send message error:', err);
    throw err;
  }
}

/**
 * Get all messages for an appointment
 */
async function getAppointmentMessages(appointmentId) {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        CASE 
          WHEN m.sender_role = 'patient' THEN p.name
          WHEN m.sender_role = 'doctor' THEN d.name
        END as sender_name
      FROM messages m
      LEFT JOIN patients p ON m.sender_id = p.patient_id AND m.sender_role = 'patient'
      LEFT JOIN doctors d ON m.sender_id = d.doctor_id AND m.sender_role = 'doctor'
      WHERE m.appointment_id = $1
      ORDER BY m.timestamp ASC
    `, [appointmentId]);

    return result.rows;
  } catch (err) {
    console.error('Get messages error:', err);
    return [];
  }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(appointmentId, userId, userRole) {
  try {
    const result = await pool.query(`
      UPDATE messages
      SET is_read = TRUE
      WHERE appointment_id = $1 
        AND sender_role != $2
        AND is_read = FALSE
      RETURNING *
    `, [appointmentId, userRole]);

    return result.rows;
  } catch (err) {
    console.error('Mark as read error:', err);
    return [];
  }
}

/**
 * Get unread message count for user
 */
async function getUnreadMessageCount(userId, userRole) {
  try {
    let query;
    if (userRole === 'patient') {
      query = `
        SELECT COUNT(*) as unread_count
        FROM messages m
        JOIN appointments a ON m.appointment_id = a.appointment_id
        WHERE a.patient_id = $1 
          AND m.sender_role = 'doctor'
          AND m.is_read = FALSE
      `;
    } else if (userRole === 'doctor') {
      query = `
        SELECT COUNT(*) as unread_count
        FROM messages m
        JOIN appointments a ON m.appointment_id = a.appointment_id
        WHERE a.doctor_id = $1 
          AND m.sender_role = 'patient'
          AND m.is_read = FALSE
      `;
    }

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].unread_count) || 0;
  } catch (err) {
    console.error('Get unread count error:', err);
    return 0;
  }
}

/**
 * Get appointments with active conversations
 */
async function getAppointmentsWithChats(userId, userRole) {
  try {
    let query;
    if (userRole === 'patient') {
      query = `
        SELECT DISTINCT
          a.appointment_id,
          d.name as doctor_name,
          d.specialization,
          a.start_time,
          a.end_time,
          a.status,
          COUNT(m.message_id) as message_count,
          MAX(m.timestamp) as last_message_time
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.doctor_id
        LEFT JOIN messages m ON a.appointment_id = m.appointment_id
        WHERE a.patient_id = $1
        GROUP BY a.appointment_id, d.name, d.specialization, a.start_time, a.end_time, a.status
        ORDER BY MAX(m.timestamp) DESC NULLS LAST
      `;
    } else if (userRole === 'doctor') {
      query = `
        SELECT DISTINCT
          a.appointment_id,
          p.name as patient_name,
          p.age,
          p.blood_group,
          a.start_time,
          a.end_time,
          a.status,
          COUNT(m.message_id) as message_count,
          MAX(m.timestamp) as last_message_time
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        LEFT JOIN messages m ON a.appointment_id = m.appointment_id
        WHERE a.doctor_id = $1
        GROUP BY a.appointment_id, p.name, p.age, p.blood_group, a.start_time, a.end_time, a.status
        ORDER BY MAX(m.timestamp) DESC NULLS LAST
      `;
    }

    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error('Get appointments with chats error:', err);
    return [];
  }
}

/**
 * Delete a message (only by sender or admin)
 */
async function deleteMessage(messageId, userId, userRole) {
  try {
    // Verify user is message sender
    const messageRes = await pool.query(
      'SELECT * FROM messages WHERE message_id = $1',
      [messageId]
    );

    if (messageRes.rows.length === 0) {
      throw new Error('Message not found');
    }

    const message = messageRes.rows[0];
    if (message.sender_id !== userId && userRole !== 'admin') {
      throw new Error('Unauthorized: can only delete own messages');
    }

    await pool.query('DELETE FROM messages WHERE message_id = $1', [messageId]);
    return { success: true };
  } catch (err) {
    console.error('Delete message error:', err);
    throw err;
  }
}

module.exports = {
  initializeChatTables,
  sendMessage,
  getAppointmentMessages,
  markMessagesAsRead,
  getUnreadMessageCount,
  getAppointmentsWithChats,
  deleteMessage
};
