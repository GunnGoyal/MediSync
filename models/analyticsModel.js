/**
 * Analytics Dashboard Model
 * Visual insights for patient & admin via charts
 */

const pool = require('../config/db');

/**
 * Get disease statistics for analytics
 */
async function getDiseaseAnalytics() {
  try {
    const result = await pool.query(`
      SELECT 
        disease_name,
        COUNT(*) as count,
        COUNT(DISTINCT patient_id) as affected_patients,
        MAX(diagnosed_date) as last_diagnosed
      FROM disease_history
      GROUP BY disease_name
      ORDER BY count DESC
      LIMIT 10
    `);

    return result.rows;
  } catch (err) {
    console.error('Disease analytics error:', err);
    return [];
  }
}

/**
 * Get medicine usage analytics
 */
async function getMedicineAnalytics() {
  try {
    const result = await pool.query(`
      SELECT 
        p.medicine_name,
        COUNT(*) as prescription_count,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        MAX(p.created_at) as last_used
      FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      GROUP BY p.medicine_name
      ORDER BY prescription_count DESC
      LIMIT 10
    `);

    return result.rows;
  } catch (err) {
    console.error('Medicine analytics error:', err);
    return [];
  }
}

/**
 * Get appointment statistics
 */
async function getAppointmentAnalytics() {
  try {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM appointments), 2) as percentage
      FROM appointments
      GROUP BY status
    `);

    return result.rows;
  } catch (err) {
    console.error('Appointment analytics error:', err);
    return [];
  }
}

/**
 * Get doctor performance metrics
 */
async function getDoctorAnalytics() {
  try {
    const result = await pool.query(`
      SELECT 
        d.doctor_id,
        d.name,
        d.specialization,
        COUNT(a.appointment_id) as total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        ROUND(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) * 100.0 / COUNT(a.appointment_id), 2) as completion_rate
      FROM doctors d
      LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
      GROUP BY d.doctor_id, d.name, d.specialization
      ORDER BY total_appointments DESC
    `);

    return result.rows;
  } catch (err) {
    console.error('Doctor analytics error:', err);
    return [];
  }
}

/**
 * Get patient health risk distribution
 */
async function getPatientHealthRiskDistribution() {
  try {
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN age < 20 THEN 'Teen (< 20)'
          WHEN age < 30 THEN 'Young Adult (20-29)'
          WHEN age < 40 THEN 'Adult (30-39)'
          WHEN age < 50 THEN 'Middle Age (40-49)'
          WHEN age < 60 THEN 'Senior (50-59)'
          ELSE 'Elderly (60+)'
        END as age_group,
        COUNT(*) as patient_count,
        AVG(COALESCE((
          SELECT COALESCE(CAST(score AS FLOAT), 0) 
          FROM (
            SELECT 0 as score
          ) t
        ), 0)) as avg_risk
      FROM patients
      WHERE age IS NOT NULL
      GROUP BY age_group
      ORDER BY MIN(age)
    `);

    return result.rows;
  } catch (err) {
    console.error('Patient health risk distribution error:', err);
    return [];
  }
}

/**
 * Get system-wide statistics
 */
async function getSystemWideStats() {
  try {
    // Get all stats in parallel
    const [patients, doctors, appointments, prescriptions, diseases] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM patients'),
      pool.query('SELECT COUNT(*) as count FROM doctors'),
      pool.query('SELECT COUNT(*) as count FROM appointments'),
      pool.query('SELECT COUNT(*) as count FROM prescriptions'),
      pool.query('SELECT COUNT(*) as count FROM disease_history')
    ]);

    // Get appointment status distribution
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM appointments
      GROUP BY status
    `);

    const statusDistribution = {};
    statusResult.rows.forEach(row => {
      statusDistribution[row.status] = parseInt(row.count);
    });

    return {
      total_patients: parseInt(patients.rows[0].count),
      total_doctors: parseInt(doctors.rows[0].count),
      total_appointments: parseInt(appointments.rows[0].count),
      total_prescriptions: parseInt(prescriptions.rows[0].count),
      total_diseases_recorded: parseInt(diseases.rows[0].count),
      appointment_status_distribution: statusDistribution
    };
  } catch (err) {
    console.error('System stats error:', err);
    throw err;
  }
}

/**
 * Get monthly appointment trends
 */
async function getMonthlyAppointmentTrends(months = 12) {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(start_time, 'YYYY-MM') as month,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM appointments
      WHERE start_time >= NOW() - INTERVAL '${months} months'
      GROUP BY TO_CHAR(start_time, 'YYYY-MM')
      ORDER BY month
    `);

    return result.rows;
  } catch (err) {
    console.error('Monthly trends error:', err);
    return [];
  }
}

/**
 * Get specialization analytics
 */
async function getSpecializationAnalytics() {
  try {
    const result = await pool.query(`
      SELECT 
        d.specialization,
        COUNT(DISTINCT d.doctor_id) as doctor_count,
        COUNT(a.appointment_id) as total_appointments,
        COUNT(DISTINCT a.patient_id) as unique_patients
      FROM doctors d
      LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
      GROUP BY d.specialization
      ORDER BY total_appointments DESC
    `);

    return result.rows;
  } catch (err) {
    console.error('Specialization analytics error:', err);
    return [];
  }
}

/**
 * Get complete analytics dashboard data
 */
async function getCompleteDashboardData() {
  try {
    const [
      diseaseAnalytics,
      medicineAnalytics,
      appointmentAnalytics,
      doctorAnalytics,
      systemStats,
      monthlyTrends,
      specializationAnalytics
    ] = await Promise.all([
      getDiseaseAnalytics(),
      getMedicineAnalytics(),
      getAppointmentAnalytics(),
      getDoctorAnalytics(),
      getSystemWideStats(),
      getMonthlyAppointmentTrends(),
      getSpecializationAnalytics()
    ]);

    return {
      system_stats: systemStats,
      disease_analytics: diseaseAnalytics,
      medicine_analytics: medicineAnalytics,
      appointment_analytics: appointmentAnalytics,
      doctor_analytics: doctorAnalytics,
      monthly_trends: monthlyTrends,
      specialization_analytics: specializationAnalytics,
      generated_at: new Date()
    };
  } catch (err) {
    console.error('Get complete dashboard error:', err);
    throw err;
  }
}

module.exports = {
  getDiseaseAnalytics,
  getMedicineAnalytics,
  getAppointmentAnalytics,
  getDoctorAnalytics,
  getPatientHealthRiskDistribution,
  getSystemWideStats,
  getMonthlyAppointmentTrends,
  getSpecializationAnalytics,
  getCompleteDashboardData
};
