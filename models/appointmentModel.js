const pool = require('../config/db');

// Overlap check: existing.start_time < new_end AND existing.end_time > new_start
async function hasOverlap({ patient_id, doctor_id, start_time, end_time }) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM appointments
     WHERE status IN ('pending','accepted') AND (
       (patient_id = $1) OR (doctor_id = $2)
     ) AND start_time < $4 AND end_time > $3`,
    [patient_id, doctor_id, start_time, end_time]
  );
  return rows[0].count > 0;
}

async function createAppointment({ patient_id, doctor_id, start_time, end_time, reason }) {
  const { rows } = await pool.query(
    `INSERT INTO appointments(patient_id,doctor_id,start_time,end_time,reason,status)
     VALUES($1,$2,$3,$4,$5,'pending') RETURNING *`,
    [patient_id, doctor_id, start_time, end_time, reason]
  );
  return rows[0];
}

async function listPatientAppointments(patient_id) {
  const { rows } = await pool.query(
    `SELECT a.*, d.name AS doctor_name, d.specialization
     FROM appointments a JOIN doctors d ON a.doctor_id=d.doctor_id
     WHERE a.patient_id=$1 ORDER BY a.start_time DESC`,
    [patient_id]
  );
  return rows;
}

async function listDoctorAppointments(doctor_id) {
  const { rows } = await pool.query(
    `SELECT a.*, p.name AS patient_name
     FROM appointments a JOIN patients p ON a.patient_id=p.patient_id
     WHERE a.doctor_id=$1 ORDER BY a.start_time ASC`,
    [doctor_id]
  );
  return rows;
}

async function updateAppointmentStatus(appointment_id, status) {
  const { rows } = await pool.query(
    `UPDATE appointments SET status=$2 WHERE appointment_id=$1 RETURNING *`,
    [appointment_id, status]
  );
  return rows[0];
}

async function getAppointmentById(appointment_id) {
  const { rows } = await pool.query(
    `SELECT a.*, p.name as patient_name, d.name as doctor_name
     FROM appointments a
     JOIN patients p ON a.patient_id=p.patient_id
     JOIN doctors d ON a.doctor_id=d.doctor_id
     WHERE a.appointment_id=$1`,
    [appointment_id]
  );
  return rows[0] || null;
}

module.exports = { hasOverlap, createAppointment, listPatientAppointments, listDoctorAppointments, updateAppointmentStatus, getAppointmentById };