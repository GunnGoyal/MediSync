const pool = require('../config/db');

async function addDiseaseHistory({ patient_id, disease_name, diagnosed_date }) {
  const { rows } = await pool.query(
    `INSERT INTO disease_history(patient_id,disease_name,diagnosed_date)
     VALUES($1,$2,$3) RETURNING *`,
    [patient_id, disease_name, diagnosed_date]
  );
  return rows[0];
}

async function listDiseaseHistory(patient_id) {
  const { rows } = await pool.query(
    `SELECT * FROM disease_history WHERE patient_id=$1 ORDER BY diagnosed_date DESC`,
    [patient_id]
  );
  return rows;
}

module.exports = { addDiseaseHistory, listDiseaseHistory };