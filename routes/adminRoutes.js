const express = require('express');
const { listUnverifiedDoctors, verifyDoctor } = require('../models/doctorModel');
const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');
const { getCache, setCache, delCache } = require('../utils/cache');

const router = express.Router();

function ensureAdmin(req, res, next) {
  if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
  next();
}

router.get('/login', (req, res) => {
  res.render('auth/admin_login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.user = { id: 0, name: 'Admin' };
    req.session.role = 'admin';
    await logAction(null, 'admin', 'Admin login', 'login', JSON.stringify({ username }));
    return res.redirect('/admin/dashboard');
  }
  res.status(401).send('Invalid admin credentials');
});

// Admin Dashboard - Main overview
router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    const cacheKey = 'admin_dashboard_stats';
    let cached = await getCache(cacheKey);
    let stats, recent;
    if (cached) {
      ({ stats, recent } = cached);
    } else {
      // Get statistics
      const { rows: statsRows } = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM patients) as total_patients,
          (SELECT COUNT(*) FROM doctors) as total_doctors,
          (SELECT COUNT(*) FROM doctors WHERE is_verified = false) as unverified_doctors,
          (SELECT COUNT(*) FROM appointments) as total_appointments,
          (SELECT COUNT(*) FROM prescriptions) as total_prescriptions
      `);

      // Recent activity
      const { rows: recentRows } = await pool.query(`
        SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10
      `);

      stats = statsRows[0];
      recent = recentRows;
      await setCache(cacheKey, { stats, recent }, 60);
    }

    res.render('admin/dashboard', { stats, recent });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading dashboard');
  }
});

// Doctor Management
router.get('/doctors', ensureAdmin, async (req, res) => {
  try {
    const { rows: doctors } = await pool.query(`
      SELECT doctor_id, name, specialization, email, is_verified, is_active, created_at
      FROM doctors
      ORDER BY created_at DESC
    `);
    
    // Count unverified
    const { rows: counts } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_verified THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN NOT is_verified THEN 1 ELSE 0 END) as unverified,
        SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactive
      FROM doctors
    `);

    res.render('admin/doctors', { doctors, counts: counts[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading doctors');
  }
});

// Verify doctor
router.post('/verify/:id', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT name FROM doctors WHERE doctor_id = $1', [id]);
    await verifyDoctor(id);
    await logAction(null, 'admin', `Verified doctor: ${rows[0].name}`, 'verify', JSON.stringify({ doctor_id: id }));
    res.redirect('/admin/doctors');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error verifying doctor');
  }
});

// Deactivate doctor
router.post('/doctors/:id/deactivate', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT name FROM doctors WHERE doctor_id = $1', [id]);
    await pool.query('UPDATE doctors SET is_active = FALSE WHERE doctor_id = $1', [id]);
    await logAction(null, 'admin', `Deactivated doctor: ${rows[0].name}`, 'update', JSON.stringify({ doctor_id: id }));
    res.redirect('/admin/doctors');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deactivating doctor');
  }
});

// Activate doctor
router.post('/doctors/:id/activate', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT name FROM doctors WHERE doctor_id = $1', [id]);
    await pool.query('UPDATE doctors SET is_active = TRUE WHERE doctor_id = $1', [id]);
    await logAction(null, 'admin', `Activated doctor: ${rows[0].name}`, 'update', JSON.stringify({ doctor_id: id }));
    res.redirect('/admin/doctors');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error activating doctor');
  }
});

// Patient Management
router.get('/patients', ensureAdmin, async (req, res) => {
  try {
    const { rows: patients } = await pool.query(`
      SELECT patient_id, name, email, age, gender, blood_group, is_active, created_at
      FROM patients
      ORDER BY created_at DESC
    `);

    const { rows: counts } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactive
      FROM patients
    `);

    res.render('admin/patients', { patients, counts: counts[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading patients');
  }
});

// Deactivate patient
router.post('/patients/:id/deactivate', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT name FROM patients WHERE patient_id = $1', [id]);
    await pool.query('UPDATE patients SET is_active = FALSE WHERE patient_id = $1', [id]);
    await logAction(null, 'admin', `Deactivated patient: ${rows[0].name}`, 'update', JSON.stringify({ patient_id: id }));
    res.redirect('/admin/patients');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deactivating patient');
  }
});

// Activate patient
router.post('/patients/:id/activate', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT name FROM patients WHERE patient_id = $1', [id]);
    await pool.query('UPDATE patients SET is_active = TRUE WHERE patient_id = $1', [id]);
    await logAction(null, 'admin', `Activated patient: ${rows[0].name}`, 'update', JSON.stringify({ patient_id: id }));
    res.redirect('/admin/patients');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error activating patient');
  }
});

// Appointment Monitoring
router.get('/appointments', ensureAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT a.appointment_id, a.status, a.start_time, a.end_time, a.reason,
             p.name as patient_name, d.name as doctor_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
    `;
    
    if (status) {
      query += ` WHERE a.status = '${status}'`;
    }
    
    query += ` ORDER BY a.start_time DESC`;

    const { rows: appointments } = await pool.query(query);

    res.render('admin/appointments', { appointments, filter: status || 'all' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading appointments');
  }
});

// Medicine & Prescription Analytics
router.get('/analytics', ensureAdmin, async (req, res) => {
  try {
    // Most prescribed medicines
    const { rows: topMedicines } = await pool.query(`
      SELECT medicine_name, COUNT(*)::int as count
      FROM prescriptions
      GROUP BY medicine_name
      ORDER BY count DESC
      LIMIT 10
    `);

    // Most diagnosed diseases
    const { rows: topDiseases } = await pool.query(`
      SELECT disease_name, COUNT(*)::int as count
      FROM disease_history
      GROUP BY disease_name
      ORDER BY count DESC
      LIMIT 10
    `);

    // High-risk medicines (prescribed 5+ times)
    const { rows: riskMedicines } = await pool.query(`
      SELECT medicine_name, COUNT(*)::int as count
      FROM prescriptions
      GROUP BY medicine_name
      HAVING COUNT(*) >= 5
      ORDER BY count DESC
    `);

    // Prescriptions by month
    const { rows: prescriptionTrend } = await pool.query(`
      SELECT DATE_TRUNC('month', created_at)::DATE as month, COUNT(*)::int as count
      FROM prescriptions
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 6
    `);

    res.render('admin/analytics', { 
      topMedicines, 
      topDiseases, 
      riskMedicines,
      prescriptionTrend
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading analytics');
  }
});

// Prediction System Oversight
router.get('/predictions', ensureAdmin, async (req, res) => {
  try {
    // Patients with repeated medicine usage
    const { rows: predictions } = await pool.query(`
      SELECT DISTINCT p.patient_id, p.name,
             pr.medicine_name,
             COUNT(*)::int as usage_count,
             CASE 
               WHEN COUNT(*) >= 6 THEN 'HIGH RISK'
               WHEN COUNT(*) >= 4 THEN 'WARNING'
               ELSE 'INFO'
             END as risk_level
      FROM prescriptions pr
      JOIN appointments a ON pr.appointment_id = a.appointment_id
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE pr.created_at > NOW() - INTERVAL '2 months'
      GROUP BY p.patient_id, p.name, pr.medicine_name
      HAVING COUNT(*) > 3
      ORDER BY usage_count DESC
    `);

    res.render('admin/predictions', { predictions });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading predictions');
  }
});

// Audit Logs
router.get('/audit-logs', ensureAdmin, async (req, res) => {
  try {
    const { rows: logs } = await pool.query(`
      SELECT * FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    res.render('admin/audit-logs', { logs });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading audit logs');
  }
});

// System Configuration
router.get('/config', ensureAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM system_config LIMIT 1');
    res.render('admin/system-config', { config: rows[0] || {} });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading configuration');
  }
});

// Update system configuration
router.post('/config/update', ensureAdmin, async (req, res) => {
  try {
    const { maintenance_mode, system_notice } = req.body;
    await pool.query(
      'UPDATE system_config SET maintenance_mode = $1, system_notice = $2, updated_at = NOW()',
      [maintenance_mode === 'on', system_notice]
    );
    await logAction(null, 'admin', 'Updated system configuration', 'update', JSON.stringify({ maintenance_mode, system_notice }));
    res.redirect('/admin/config');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating configuration');
  }
});

// Database Backup trigger (simulation)
router.post('/backup', ensureAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE system_config SET last_backup = NOW()');
    await logAction(null, 'admin', 'Triggered database backup', 'create', null);
    res.json({ success: true, message: 'Backup triggered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error triggering backup' });
  }
});

router.post('/logout', ensureAdmin, async (req, res) => {
  await logAction(null, 'admin', 'Admin logout', 'logout', null);
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;