/**
 * Medicine Repetition & Dependency Detection Model
 * Detects overuse of same medicine and warns about potential dependency
 */

const pool = require('../config/db');

/**
 * Detect repeated medicines for a patient
 * Returns medicines prescribed more than 4 times
 */
async function detectMedicineRepetition(patientId) {
  try {
    const query = `
      SELECT 
        p.medicine_name,
        COUNT(*) as prescription_count,
        STRING_AGG(DISTINCT d.disease_name, ', ') as associated_diseases,
        MAX(p.created_at) as last_prescribed
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.appointment_id
      LEFT JOIN disease_history d ON a.patient_id = d.patient_id
      WHERE a.patient_id = $1
      GROUP BY p.medicine_name
      HAVING COUNT(*) > 2
      ORDER BY prescription_count DESC
    `;

    const result = await pool.query(query, [patientId]);
    
    return result.rows.map(medicine => ({
      medicine_name: medicine.medicine_name,
      prescription_count: parseInt(medicine.prescription_count),
      associated_diseases: medicine.associated_diseases,
      last_prescribed: medicine.last_prescribed,
      risk_level: medicine.prescription_count > 4 ? 'high' : 'moderate',
      warning: medicine.prescription_count > 4 
        ? `${medicine.medicine_name} prescribed ${medicine.prescription_count} times – risk of dependency.`
        : `${medicine.medicine_name} prescribed ${medicine.prescription_count} times – monitor usage.`
    }));
  } catch (err) {
    console.error('Medicine repetition detection error:', err);
    return [];
  }
}

/**
 * Get medicine dependency warnings for a patient
 * Returns high-risk medicines that exceed threshold
 */
async function getMedicineDependencyWarnings(patientId) {
  try {
    const repetitions = await detectMedicineRepetition(patientId);
    const warnings = repetitions.filter(m => m.risk_level === 'high');
    
    return {
      total_repeated_medicines: repetitions.length,
      high_risk_count: warnings.length,
      warnings: warnings,
      recommendation: warnings.length > 0 
        ? 'Consult doctor about medicine dependency risks'
        : 'No high-risk medicine dependencies detected'
    };
  } catch (err) {
    console.error('Medicine dependency warning error:', err);
    return {
      total_repeated_medicines: 0,
      high_risk_count: 0,
      warnings: [],
      recommendation: 'Unable to assess'
    };
  }
}

/**
 * Get medicine usage statistics for a patient
 */
async function getMedicineUsageStats(patientId) {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT p.medicine_name) as total_unique_medicines,
        COUNT(*) as total_prescriptions,
        MAX(p.created_at) as latest_prescription,
        MIN(p.created_at) as first_prescription
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.appointment_id
      WHERE a.patient_id = $1
    `;

    const result = await pool.query(query, [patientId]);
    return result.rows[0] || {
      total_unique_medicines: 0,
      total_prescriptions: 0,
      latest_prescription: null,
      first_prescription: null
    };
  } catch (err) {
    console.error('Medicine usage stats error:', err);
    return {
      total_unique_medicines: 0,
      total_prescriptions: 0,
      latest_prescription: null,
      first_prescription: null
    };
  }
}

module.exports = {
  detectMedicineRepetition,
  getMedicineDependencyWarnings,
  getMedicineUsageStats
};
