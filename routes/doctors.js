const express = require('express');
const router = express.Router();
const { registerDoctor, loginDoctor } = require('../controllers/doctorsController');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const db = require('../db');

// Doctor registration route
router.post('/register', registerDoctor);

// Doctor login route
router.post('/login', loginDoctor);

// JWT-protected doctor profile route
router.get('/profile', auth, (req, res) => {
  res.json({ id: req.doctor.id, name: req.doctor.name });
});

// Doctor dashboard (protected)
router.get('/dashboard', doctorAuth, async (req, res) => {
  try {
    const doctor_id = req.session.doctor.id;
    // Try to get appointments, but don't fail if table doesn't exist
    let appointments = [];
    try {
      const result = await db.query(
        `SELECT a.*, p.name as patient_name 
         FROM appointments a 
         JOIN patients p ON a.patient_id = p.id 
         WHERE a.doctor_id = $1 
         ORDER BY 
           CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
           a.appointment_date, 
           a.start_time`,
        [doctor_id]
      );
      appointments = result.rows;
    } catch (err) {
      console.log('Appointments table not found or error:', err.message);
    }
    res.render('doctors/dashboard', { 
      doctor: req.session.doctor, 
      error: null, 
      appointments: appointments 
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('doctors/dashboard', { 
      doctor: req.session.doctor, 
      error: 'Error loading appointments.', 
      appointments: [] 
    });
  }
});

// Accept appointment
router.post('/appointment/:id/accept', doctorAuth, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    
    // Get appointment details before updating
    const appointmentResult = await db.query(
      'SELECT a.*, p.id as patient_id, p.name as patient_name, d.name as doctor_name, d.specialization FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id WHERE a.id = $1',
      [appointmentId]
    );
    
    await db.query(
      'UPDATE appointments SET status = $1 WHERE id = $2',
      ['accepted', appointmentId]
    );
    
    // Emit Socket.IO event for real-time update
    const io = req.app.get('io');
    if (io && appointmentResult.rows.length > 0) {
      const appointment = appointmentResult.rows[0];
      io.emit('appointmentStatusUpdated', {
        appointmentId: parseInt(appointmentId),
        patientId: appointment.patient_id,
        status: 'accepted',
        doctorName: appointment.doctor_name,
        specialization: appointment.specialization,
        appointmentDate: appointment.appointment_date,
        startTime: appointment.start_time,
        endTime: appointment.end_time
      });
      console.log('📡 Emitted appointmentStatusUpdated (accepted) for patient:', appointment.patient_id);
    }
    
    res.redirect('/doctors/dashboard');
  } catch (err) {
    console.error('Error accepting appointment:', err);
    res.status(500).send('Error accepting appointment');
  }
});

// Reject appointment
router.post('/appointment/:id/reject', doctorAuth, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    
    // Get appointment details before updating
    const appointmentResult = await db.query(
      'SELECT a.*, p.id as patient_id, p.name as patient_name, d.name as doctor_name, d.specialization FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id WHERE a.id = $1',
      [appointmentId]
    );
    
    await db.query(
      'UPDATE appointments SET status = $1 WHERE id = $2',
      ['rejected', appointmentId]
    );
    
    // Emit Socket.IO event for real-time update
    const io = req.app.get('io');
    if (io && appointmentResult.rows.length > 0) {
      const appointment = appointmentResult.rows[0];
      io.emit('appointmentStatusUpdated', {
        appointmentId: parseInt(appointmentId),
        patientId: appointment.patient_id,
        status: 'rejected',
        doctorName: appointment.doctor_name,
        specialization: appointment.specialization,
        appointmentDate: appointment.appointment_date,
        startTime: appointment.start_time,
        endTime: appointment.end_time
      });
      console.log('📡 Emitted appointmentStatusUpdated (rejected) for patient:', appointment.patient_id);
    }
    
    res.redirect('/doctors/dashboard');
  } catch (err) {
    console.error('Error rejecting appointment:', err);
    res.status(500).send('Error rejecting appointment');
  }
});

module.exports = router;
