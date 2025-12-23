const express = require('express');
const dayjs = require('dayjs');
const { body, validationResult } = require('express-validator');
const { listDoctors } = require('../models/doctorModel');
const { hasOverlap, createAppointment, listPatientAppointments, getAppointmentById } = require('../models/appointmentModel');
const { listPrescriptionsForPatient, listPrescriptionsForAppointment } = require('../models/prescriptionModel');
const { listDiseaseHistory } = require('../models/diseaseHistoryModel');
const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const { getCache, setCache, delCache } = require('../utils/cache');

const router = express.Router();

function ensurePatient(req, res, next) {
  if (req.session.role !== 'patient') return res.status(403).send('Forbidden');
  next();
}

router.get('/dashboard', ensurePatient, async (req, res) => {
  const cacheKey = `patient_summary_${req.session.user.id}`;
  let cached = await getCache(cacheKey);
  let upcoming, prescriptions, summary;
  if (cached) {
    ({ upcoming, prescriptions, summary } = cached);
  } else {
    upcoming = await listPatientAppointments(req.session.user.id);
    prescriptions = await listPrescriptionsForPatient(req.session.user.id);
    summary = { totalAppointments: upcoming.length, totalPrescriptions: prescriptions.length };
    await setCache(cacheKey, { upcoming, prescriptions, summary }, 60);
  }
  res.render('patient/dashboard', { upcoming, prescriptions, summary });
});

router.get('/book', ensurePatient, async (req, res) => {
  const doctors = await listDoctors();
  res.render('patient/book', { doctors });
});

router.post('/book',
  ensurePatient,
  body('doctor_id').isInt({ gt: 0 }),
  body('date').isISO8601(),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('end_time').matches(/^\d{2}:\d{2}$/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { doctor_id, date, start_time, end_time, reason } = req.body;
    const start = dayjs(`${date} ${start_time}`);
    const end = dayjs(`${date} ${end_time}`);
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      return res.status(400).send('Invalid start/end time');
    }
    if (start.isBefore(dayjs())) {
      return res.status(400).send('Cannot book past dates');
    }

    const overlap = await hasOverlap({
      patient_id: req.session.user.id,
      doctor_id: parseInt(doctor_id, 10),
      start_time: start.toDate(),
      end_time: end.toDate(),
    });
    if (overlap) return res.status(400).send('Appointment overlaps with existing');

    await createAppointment({
      patient_id: req.session.user.id,
      doctor_id: parseInt(doctor_id, 10),
      start_time: start.toDate(),
      end_time: end.toDate(),
      reason,
    });
    await delCache(`patient_summary_${req.session.user.id}`);
    res.redirect('/patient/dashboard');
  }
);

router.get('/history', ensurePatient, async (req, res) => {
  const history = await listDiseaseHistory(req.session.user.id);
  res.render('patient/history', { history });
});

router.get('/prescriptions', ensurePatient, async (req, res) => {
  const prescriptions = await listPrescriptionsForPatient(req.session.user.id);
  res.render('patient/prescriptions', { prescriptions });
});

router.get('/prediction', ensurePatient, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT medicine_name, COUNT(*)::int AS count
     FROM prescriptions pr
     JOIN appointments a ON pr.appointment_id=a.appointment_id
     WHERE a.patient_id=$1 AND pr.created_at > NOW() - INTERVAL '2 months'
     GROUP BY medicine_name ORDER BY count DESC`,
    [req.session.user.id]
  );
  res.render('patient/prediction', { stats: rows });
});

router.get('/prescription/:id/pdf', ensurePatient, async (req, res) => {
  const prescription_id = parseInt(req.params.id, 10);
  
  // Verify prescription belongs to the logged-in patient
  const { rows: presc } = await pool.query(
    `SELECT pr.*, a.patient_id, d.name as doctor_name
     FROM prescriptions pr
     JOIN appointments a ON pr.appointment_id = a.appointment_id
     JOIN doctors d ON a.doctor_id = d.doctor_id
     WHERE pr.prescription_id = $1`,
    [prescription_id]
  );
  
  if (presc.length === 0 || presc[0].patient_id !== req.session.user.id) {
    return res.status(404).send('Prescription not found');
  }

  const prescription = presc[0];
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=prescription_${prescription_id}.pdf`);
  doc.pipe(res);
  
  // PDF Header
  doc.fontSize(20).font('Helvetica-Bold').text('Medisync Prescription', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text('Digital Health Consultation Platform', { align: 'center' });
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();
  
  // Patient & Doctor Info
  doc.fontSize(12).font('Helvetica-Bold').text('Patient & Doctor Information', { underline: true });
  doc.fontSize(10).font('Helvetica');
  doc.text(`Doctor: ${prescription.doctor_name}`);
  doc.text(`Prescription ID: #${prescription_id}`);
  doc.text(`Date: ${new Date(prescription.created_at).toLocaleDateString()}`);
  doc.moveDown();
  
  // Medicine Details
  doc.fontSize(12).font('Helvetica-Bold').text('Medicine Details', { underline: true });
  doc.fontSize(10).font('Helvetica');
  doc.text(`Medicine: ${prescription.medicine_name}`);
  doc.text(`Dosage: ${prescription.dosage}`);
  doc.text(`Duration: ${prescription.duration}`);
  if (prescription.instructions) {
    doc.text(`Instructions: ${prescription.instructions}`);
  }
  doc.moveDown();
  
  // Footer
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.fontSize(9).text('This is a digital prescription. Please consult with your doctor for any clarifications.', { align: 'center', color: '#666' });
  doc.text('Medisync - Connecting Care, Predicting Health', { align: 'center' });
  
  doc.end();
});

module.exports = router;