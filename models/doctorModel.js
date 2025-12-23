const pool = require('../config/db');

async function createDoctor({ name, specialization, email, password }) {
  const { rows } = await pool.query(
    `INSERT INTO doctors(name,specialization,email,password,is_verified)
     VALUES($1,$2,$3,$4,false) RETURNING doctor_id,name,specialization,email,is_verified`,
    [name, specialization, email, password]
  );
  return rows[0];
}

async function findDoctorByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE email=$1', [email]);
  return rows[0] || null;
}

async function getDoctorById(id) {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE doctor_id=$1', [id]);
  return rows[0] || null;
}

async function listDoctors() {
  const { rows } = await pool.query('SELECT doctor_id,name,specialization,is_verified FROM doctors ORDER BY name');
  return rows;
}

async function listUnverifiedDoctors() {
  const { rows } = await pool.query('SELECT doctor_id,name,specialization,email FROM doctors WHERE is_verified=false ORDER BY name');
  return rows;
}

async function verifyDoctor(doctor_id) {
  const { rows } = await pool.query('UPDATE doctors SET is_verified=true WHERE doctor_id=$1 RETURNING doctor_id,name,specialization,email,is_verified', [doctor_id]);
  return rows[0];
}

module.exports = { createDoctor, findDoctorByEmail, getDoctorById, listDoctors, listUnverifiedDoctors, verifyDoctor };