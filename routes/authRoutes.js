const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { createPatient, findPatientByEmail } = require('../models/patientModel');
const { createDoctor, findDoctorByEmail } = require('../models/doctorModel');
const { logAction } = require('../utils/auditLog');
const adminRouter = express.Router();

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('auth/login');
});

router.get('/register', (req, res) => {
  res.render('auth/register-choice');
});

router.get('/patient/register', (req, res) => {
  res.render('auth/patient-register');
});

router.get('/doctor/register', (req, res) => {
  res.render('auth/doctor-register');
});

router.post('/patient/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, password, age, gender, blood_group } = req.body;
    const existing = await findPatientByEmail(email);
    if (existing) return res.status(400).send('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    const patient = await createPatient({ name, email, password: hash, age, gender, blood_group });
    req.session.user = { id: patient.patient_id, name: patient.name };
    req.session.role = 'patient';
    res.redirect('/patient/dashboard');
  }
);

router.post('/doctor/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, specialization, email, password } = req.body;
    const existing = await findDoctorByEmail(email);
    if (existing) return res.status(400).send('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    const doctor = await createDoctor({ name, specialization, email, password: hash });
    // Admin verification can be simulated with a flag; for now allow login
    req.session.user = { id: doctor.doctor_id, name: doctor.name };
    req.session.role = 'doctor';
    res.redirect('/doctor/dashboard');
  }
);

router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (role === 'patient') {
    const user = await findPatientByEmail(email);
    if (!user) return res.status(400).send('Invalid credentials');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send('Invalid credentials');
    req.session.user = { id: user.patient_id, name: user.name };
    req.session.role = 'patient';
    await logAction(user.patient_id, 'patient', `Patient login: ${user.name}`, 'login', JSON.stringify({ email }));
    return res.redirect('/patient/dashboard');
  }
  if (role === 'doctor') {
    const user = await findDoctorByEmail(email);
    if (!user) return res.status(400).send('Invalid credentials');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send('Invalid credentials');
    if (!user.is_verified) return res.status(403).send('Doctor not verified by admin');
    req.session.user = { id: user.doctor_id, name: user.name };
    req.session.role = 'doctor';
    await logAction(user.doctor_id, 'doctor', `Doctor login: ${user.name}`, 'login', JSON.stringify({ email }));
    return res.redirect('/doctor/dashboard');
  }
  res.status(400).send('Role must be patient or doctor');
});

router.post('/logout', async (req, res) => {
  const user = req.session.user;
  const role = req.session.role;
  if (user && role) {
    await logAction(user.id, role, `${role.charAt(0).toUpperCase() + role.slice(1)} logout: ${user.name}`, 'logout', null);
  }
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;