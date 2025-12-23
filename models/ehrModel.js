/**
 * Electronic Health Record (EHR) System
 * Centralized lifelong medical records
 */

const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Initialize EHR tables
 */
async function initializeEHRTables() {
  try {
    // Create medical reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_reports (
        report_id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
        report_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_path TEXT,
        file_size INT,
        uploaded_by INT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE
      );
    `);

    // Create EHR timeline table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ehr_timeline (
        timeline_id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
        event_type VARCHAR(50) CHECK (event_type IN ('prescription', 'diagnosis', 'appointment', 'report', 'lab_test')),
        event_title VARCHAR(255) NOT NULL,
        event_description TEXT,
        event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        related_report_id INT REFERENCES medical_reports(report_id)
      );
    `);

    // Create medical reports index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_reports_patient_id 
      ON medical_reports(patient_id);
    `);

    // Create EHR timeline index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ehr_timeline_patient_id 
      ON ehr_timeline(patient_id);
    `);

    return { success: true };
  } catch (err) {
    console.error('EHR table initialization error:', err);
    throw err;
  }
}

/**
 * Upload a medical report
 */
async function uploadMedicalReport(patientId, reportType, title, description, filePath, fileSize, uploadedBy) {
  try {
    const result = await pool.query(`
      INSERT INTO medical_reports 
      (patient_id, report_type, title, description, file_path, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [patientId, reportType, title, description, filePath, fileSize, uploadedBy]);

    // Add timeline entry
    await pool.query(`
      INSERT INTO ehr_timeline (patient_id, event_type, event_title, event_description, related_report_id)
      VALUES ($1, 'report', $2, $3, $4)
    `, [patientId, `${reportType} uploaded`, title, result.rows[0].report_id]);

    return result.rows[0];
  } catch (err) {
    console.error('Upload medical report error:', err);
    throw err;
  }
}

/**
 * Get patient's medical reports
 */
async function getPatientMedicalReports(patientId) {
  try {
    const result = await pool.query(`
      SELECT 
        mr.*,
        u.name as uploaded_by_name
      FROM medical_reports mr
      LEFT JOIN (
        SELECT patient_id as uid_patient, name FROM patients
        UNION ALL
        SELECT doctor_id, name FROM doctors
      ) u ON mr.uploaded_by = u.uid_patient
      WHERE mr.patient_id = $1
      ORDER BY mr.uploaded_at DESC
    `, [patientId]);

    return result.rows;
  } catch (err) {
    console.error('Get medical reports error:', err);
    return [];
  }
}

/**
 * Get patient's EHR timeline
 */
async function getPatientEHRTimeline(patientId, limit = 50) {
  try {
    const result = await pool.query(`
      SELECT * FROM ehr_timeline
      WHERE patient_id = $1
      ORDER BY event_date DESC
      LIMIT $2
    `, [patientId, limit]);

    return result.rows;
  } catch (err) {
    console.error('Get EHR timeline error:', err);
    return [];
  }
}

/**
 * Create EHR summary for patient
 */
async function getEHRSummary(patientId) {
  try {
    // Get patient info
    const patientRes = await pool.query(
      'SELECT * FROM patients WHERE patient_id = $1',
      [patientId]
    );

    if (patientRes.rows.length === 0) {
      throw new Error('Patient not found');
    }

    const patient = patientRes.rows[0];

    // Get disease history
    const diseaseRes = await pool.query(`
      SELECT disease_name, COUNT(*) as count, MAX(diagnosed_date) as last_diagnosed
      FROM disease_history
      WHERE patient_id = $1
      GROUP BY disease_name
      ORDER BY count DESC
    `, [patientId]);

    // Get medications
    const medicineRes = await pool.query(`
      SELECT p.medicine_name, COUNT(*) as count, MAX(p.created_at) as last_prescribed
      FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      WHERE a.patient_id = $1
      GROUP BY p.medicine_name
      ORDER BY count DESC
    `, [patientId]);

    // Get recent appointments
    const appointmentRes = await pool.query(`
      SELECT a.*, d.name as doctor_name, d.specialization
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE a.patient_id = $1
      ORDER BY a.start_time DESC
      LIMIT 5
    `, [patientId]);

    // Get report count
    const reportRes = await pool.query(
      'SELECT COUNT(*) as total_reports FROM medical_reports WHERE patient_id = $1',
      [patientId]
    );

    return {
      patient: {
        id: patient.patient_id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        blood_group: patient.blood_group
      },
      medical_summary: {
        disease_history: diseaseRes.rows,
        current_medications: medicineRes.rows,
        total_reports: parseInt(reportRes.rows[0].total_reports),
        recent_appointments: appointmentRes.rows
      }
    };
  } catch (err) {
    console.error('Get EHR summary error:', err);
    throw err;
  }
}

/**
 * Add timeline event
 */
async function addTimelineEvent(patientId, eventType, eventTitle, eventDescription, reportId = null) {
  try {
    const result = await pool.query(`
      INSERT INTO ehr_timeline (patient_id, event_type, event_title, event_description, related_report_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [patientId, eventType, eventTitle, eventDescription, reportId]);

    return result.rows[0];
  } catch (err) {
    console.error('Add timeline event error:', err);
    throw err;
  }
}

/**
 * Get report by ID
 */
async function getMedicalReport(reportId) {
  try {
    const result = await pool.query(
      'SELECT * FROM medical_reports WHERE report_id = $1',
      [reportId]
    );

    return result.rows[0] || null;
  } catch (err) {
    console.error('Get medical report error:', err);
    return null;
  }
}

/**
 * Delete medical report
 */
async function deleteMedicalReport(reportId) {
  try {
    // Get report to delete file
    const report = await getMedicalReport(reportId);
    
    if (report && report.file_path && fs.existsSync(report.file_path)) {
      fs.unlinkSync(report.file_path);
    }

    await pool.query('DELETE FROM medical_reports WHERE report_id = $1', [reportId]);
    return { success: true };
  } catch (err) {
    console.error('Delete medical report error:', err);
    throw err;
  }
}

module.exports = {
  initializeEHRTables,
  uploadMedicalReport,
  getPatientMedicalReports,
  getPatientEHRTimeline,
  getEHRSummary,
  addTimelineEvent,
  getMedicalReport,
  deleteMedicalReport
};
