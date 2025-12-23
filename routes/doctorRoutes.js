const express = require('express');
const { listDoctorAppointments, updateAppointmentStatus, getAppointmentById } = require('../models/appointmentModel');
const { createPrescription, listPrescriptionsForAppointment } = require('../models/prescriptionModel');
const { addDiseaseHistory, listDiseaseHistory } = require('../models/diseaseHistoryModel');
const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const { logAction } = require('../utils/auditLog');
const { getCache, setCache, delCache } = require('../utils/cache');

const router = express.Router();

function ensureDoctor(req, res, next) {
  if (req.session.role !== 'doctor') return res.status(403).send('Forbidden');
  next();
}

router.get('/dashboard', ensureDoctor, async (req, res) => {
  const cacheKey = `doctor_appointments_${req.session.user.id}`;
  let appointments = await getCache(cacheKey);
  if (!appointments) {
    appointments = await listDoctorAppointments(req.session.user.id);
    await setCache(cacheKey, appointments, 60);
  }
  res.render('doctor/dashboard', { appointments });
});

router.post('/appointments/:id/status', ensureDoctor, async (req, res) => {
  const { status } = req.body; // 'accepted' | 'rejected' | 'completed'
  if (!['accepted','rejected','completed'].includes(status)) return res.status(400).send('Invalid status');
  await updateAppointmentStatus(parseInt(req.params.id, 10), status);
  await delCache(`doctor_appointments_${req.session.user.id}`);
  res.redirect('/doctor/dashboard');
});

router.get('/consult/:id', ensureDoctor, async (req, res) => {
  const appointment_id = parseInt(req.params.id, 10);
  const appt = await getAppointmentById(appointment_id);
  const prescriptions = await listPrescriptionsForAppointment(appointment_id);
  const history = await listDiseaseHistory(appt.patient_id);
  // Smart alert: repetition of same medicine in last 2 months
  const { rows: rep } = await pool.query(
    `SELECT pr.medicine_name, COUNT(*)::int AS count
     FROM prescriptions pr JOIN appointments a ON pr.appointment_id=a.appointment_id
     WHERE a.patient_id=$1 AND pr.created_at > NOW() - INTERVAL '2 months'
     GROUP BY pr.medicine_name HAVING COUNT(*) > 3 ORDER BY count DESC`,
    [appt.patient_id]
  );
  res.render('doctor/consult', { appointment_id, prescriptions, history, appt, alerts: rep });
});

const { body, validationResult } = require('express-validator');

router.post('/prescribe',
  ensureDoctor,
  body('appointment_id').isInt({ gt: 0 }),
  body('medicine_name').isString().isLength({ min: 1 }),
  body('dosage').isString().isLength({ min: 1 }),
  body('duration').isString().isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { appointment_id, medicine_name, dosage, duration, instructions } = req.body;
    await createPrescription({ appointment_id: parseInt(appointment_id, 10), medicine_name, dosage, duration, instructions });
    await logAction(req.session.user.id, 'doctor', `Created prescription: ${medicine_name} for appointment #${appointment_id}`, 'create', JSON.stringify({ appointment_id, medicine_name, dosage }));
    res.redirect(`/doctor/consult/${appointment_id}`);
  }
);

router.post('/diagnose', ensureDoctor, async (req, res) => {
  const { appointment_id, disease_name } = req.body;
  const appt = await getAppointmentById(parseInt(appointment_id, 10));
  await addDiseaseHistory({ patient_id: appt.patient_id, disease_name, diagnosed_date: new Date() });
  await logAction(req.session.user.id, 'doctor', `Added diagnosis: ${disease_name} for patient #${appt.patient_id}`, 'create', JSON.stringify({ appointment_id, disease_name }));
  res.redirect(`/doctor/consult/${appointment_id}`);
});

router.get('/prescription/:id/pdf', ensureDoctor, async (req, res) => {
  const appointment_id = parseInt(req.params.id, 10);
  const prescriptions = await listPrescriptionsForAppointment(appointment_id);
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=prescription_${appointment_id}.pdf`);
  doc.pipe(res);
  doc.fontSize(18).text('Medisync Prescription');
  doc.moveDown();
  prescriptions.forEach(p => {
    doc.fontSize(12).text(`Medicine: ${p.medicine_name} | Dosage: ${p.dosage} | Duration: ${p.duration}`);
    if (p.instructions) doc.text(`Instructions: ${p.instructions}`);
    doc.moveDown();
  });
  doc.end();
});

module.exports = router;