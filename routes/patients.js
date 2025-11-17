const express = require('express');
const router = express.Router();
const {
    registerPatient,
    getPatientById,
    getAllPatients,
    updatePatient,
    deletePatient,
    loginPatient
} = require('../controllers/patientsController');

// Patient registration route
router.post('/register', registerPatient);

// Patient login route
router.post('/login', loginPatient);

// Get patient profile route
router.get('/profile/:id', getPatientById);

// Get all patients route (for admin/staff use)
router.get('/', getAllPatients);

// Update patient route
router.put('/update/:id', updatePatient);

// Delete patient route
router.delete('/delete/:id', deletePatient);

module.exports = router;