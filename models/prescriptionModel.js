const pool = require('../config/db');

async function createPrescription({ appointment_id, medicine_name, dosage, duration, instructions }) {
  const { rows } = await pool.query(
    `INSERT INTO prescriptions(appointment_id,medicine_name,dosage,duration,instructions)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [appointment_id, medicine_name, dosage, duration, instructions]
  );
  return rows[0];
}

async function listPrescriptionsForPatient(patient_id) {
  const { rows } = await pool.query(
    `SELECT pr.*, d.name as doctor_name
     FROM prescriptions pr
     JOIN appointments a ON pr.appointment_id = a.appointment_id
     JOIN doctors d ON a.doctor_id = d.doctor_id
     WHERE a.patient_id=$1
     ORDER BY pr.prescription_id DESC`,
    [patient_id]
  );
  return rows;
}

async function listPrescriptionsForAppointment(appointment_id) {
  const { rows } = await pool.query(
    `SELECT * FROM prescriptions WHERE appointment_id=$1 ORDER BY prescription_id`,
    [appointment_id]
  );
  return rows;
}

module.exports = { createPrescription, listPrescriptionsForPatient, listPrescriptionsForAppointment };