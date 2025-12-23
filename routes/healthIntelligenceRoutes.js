const express = require('express');
const { getHealthIntelligenceReport } = require('../models/healthIntelligenceModel');

const router = express.Router();

function ensurePatient(req, res, next) {
  if (req.session.role !== 'patient') return res.status(403).send('Forbidden');
  next();
}

/**
 * Health Intelligence Dashboard - Shows all 3 features
 * 1. Disease Pattern Detection
 * 2. Allergy Detection
 * 3. Health Risk Score
 */
router.get('/dashboard', ensurePatient, async (req, res) => {
  try {
    const report = await getHealthIntelligenceReport(req.session.user.id);
    res.render('health-intelligence/dashboard', { report });
  } catch (err) {
    console.error('Error loading health intelligence dashboard:', err);
    res.status(500).send('Error loading health intelligence');
  }
});

/**
 * Disease Pattern Detection - Detailed view
 */
router.get('/disease-patterns', ensurePatient, async (req, res) => {
  try {
    const report = await getHealthIntelligenceReport(req.session.user.id);
    res.render('health-intelligence/disease-patterns', { report });
  } catch (err) {
    console.error('Error loading disease patterns:', err);
    res.status(500).send('Error loading disease patterns');
  }
});

/**
 * Allergy Detection - Detailed view
 */
router.get('/allergy-detection', ensurePatient, async (req, res) => {
  try {
    const report = await getHealthIntelligenceReport(req.session.user.id);
    res.render('health-intelligence/allergy-detection', { report });
  } catch (err) {
    console.error('Error loading allergy detection:', err);
    res.status(500).send('Error loading allergy detection');
  }
});

/**
 * Health Risk Score - Detailed view with breakdown
 */
router.get('/health-risk-score', ensurePatient, async (req, res) => {
  try {
    const report = await getHealthIntelligenceReport(req.session.user.id);
    res.render('health-intelligence/health-risk-score', { report });
  } catch (err) {
    console.error('Error loading health risk score:', err);
    res.status(500).send('Error loading health risk score');
  }
});

/**
 * API endpoint for health intelligence report (JSON)
 */
router.get('/api/report', ensurePatient, async (req, res) => {
  try {
    const report = await getHealthIntelligenceReport(req.session.user.id);
    res.json(report);
  } catch (err) {
    console.error('Error generating health report:', err);
    res.status(500).json({ error: 'Error generating report' });
  }
});

module.exports = router;
