const pool = require('../config/db');

async function createPatient({ name, email, password, age, gender, blood_group }) {
  const { rows } = await pool.query(
    `INSERT INTO patients(name,email,password,age,gender,blood_group)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING patient_id,name,email,age,gender,blood_group`,
    [name, email, password, age, gender, blood_group]
  );
  return rows[0];
}

async function findPatientByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM patients WHERE email=$1', [email]);
  return rows[0] || null;
}

async function getPatientById(id) {
  const { rows } = await pool.query('SELECT * FROM patients WHERE patient_id=$1', [id]);
  return rows[0] || null;
}

module.exports = { createPatient, findPatientByEmail, getPatientById };