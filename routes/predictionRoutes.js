const express = require('express');
const pool = require('../config/db');

const router = express.Router();

function ensureAuth(req, res, next) {
  if (!req.session.user) return res.status(403).send('Forbidden');
  next();
}

router.get('/medicine-repetition/:patientId', ensureAuth, async (req, res) => {
  const patientId = parseInt(req.params.patientId, 10);
  const { rows } = await pool.query(
    `SELECT pr.medicine_name, COUNT(*)::int AS count
     FROM prescriptions pr
     JOIN appointments a ON pr.appointment_id=a.appointment_id
     WHERE a.patient_id=$1
     GROUP BY pr.medicine_name HAVING COUNT(*) > 3
     ORDER BY count DESC`,
    [patientId]
  );
  res.json(rows);
});

module.exports = router;