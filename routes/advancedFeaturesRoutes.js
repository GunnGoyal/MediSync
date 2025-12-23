/**
 * Advanced Features Routes
 * Medicine Repetition, Enhanced Risk, Chat, EHR, and Analytics
 */

const express = require('express');
const router = express.Router();
const medicineModel = require('../models/medicineRepetitionModel');
const healthRiskModel = require('../models/enhancedHealthRiskModel');
const chatModel = require('../models/chatModel');
const ehrModel = require('../models/ehrModel');
const analyticsModel = require('../models/analyticsModel');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ===== MEDICINE REPETITION & DEPENDENCY ROUTES =====

/**
 * GET /advanced/medicine-repetition/:patientId
 * Get medicine repetition detection for a patient
 */
router.get('/medicine-repetition/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Check authorization
    if (req.session.role === 'patient' && req.session.user.id != patientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const repetitions = await medicineModel.detectMedicineRepetition(patientId);
    const warnings = await medicineModel.getMedicineDependencyWarnings(patientId);
    const stats = await medicineModel.getMedicineUsageStats(patientId);

    res.json({
      repetitions,
      warnings,
      stats,
      message: `Medicine repetition analysis for patient ${patientId}`
    });
  } catch (err) {
    console.error('Medicine repetition route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/medicine-repetition-dashboard/:patientId
 * Render medicine repetition dashboard
 */
router.get('/medicine-repetition-dashboard/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const repetitions = await medicineModel.detectMedicineRepetition(patientId);
    const warnings = await medicineModel.getMedicineDependencyWarnings(patientId);
    const stats = await medicineModel.getMedicineUsageStats(patientId);

    res.render('advanced/medicine-repetition', {
      patientId,
      repetitions,
      warnings,
      stats
    });
  } catch (err) {
    console.error('Medicine dashboard error:', err);
    res.status(500).send('Error loading medicine repetition dashboard');
  }
});

// ===== ENHANCED HEALTH RISK ROUTES =====

/**
 * GET /advanced/health-risk/:patientId
 * Get enhanced health risk score for a patient
 */
router.get('/health-risk/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const riskScore = await healthRiskModel.calculateEnhancedHealthRiskScore(patientId);
    const recommendations = healthRiskModel.getRiskRecommendations(riskScore.score, riskScore.factors);
    const color = healthRiskModel.getRiskLevelColor(riskScore.level);

    res.json({
      score: riskScore,
      recommendations,
      color
    });
  } catch (err) {
    console.error('Health risk route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/health-risk-dashboard/:patientId
 * Render health risk dashboard
 */
router.get('/health-risk-dashboard/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const riskScore = await healthRiskModel.calculateEnhancedHealthRiskScore(patientId);
    const recommendations = healthRiskModel.getRiskRecommendations(riskScore.score, riskScore.factors);
    const color = healthRiskModel.getRiskLevelColor(riskScore.level);

    res.render('advanced/health-risk', {
      patientId,
      riskScore,
      recommendations,
      color
    });
  } catch (err) {
    console.error('Health risk dashboard error:', err);
    res.status(500).send('Error loading health risk dashboard');
  }
});

// ===== CHAT ROUTES =====

/**
 * POST /advanced/chat/send
 * Send a message in appointment chat
 */
router.post('/chat/send', requireAuth, async (req, res) => {
  try {
    const { appointmentId, message } = req.body;
    const { id: senderId } = req.session.user;
    const { role: senderRole } = req.session;

    const result = await chatModel.sendMessage(appointmentId, senderId, senderRole, message);
    res.json(result);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/chat/:appointmentId
 * Get all messages for an appointment
 */
router.get('/chat/:appointmentId', requireAuth, async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const messages = await chatModel.getAppointmentMessages(appointmentId);
    const { id: userId } = req.session.user;
    const { role: userRole } = req.session;

    // Mark as read
    await chatModel.markMessagesAsRead(appointmentId, userId, userRole);

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/chat-conversations
 * Get list of appointments with active chats
 */
router.get('/chat-conversations', requireAuth, async (req, res) => {
  try {
    const { id: userId } = req.session.user;
    const { role: userRole } = req.session;

    const conversations = await chatModel.getAppointmentsWithChats(userId, userRole);
    const unreadCount = await chatModel.getUnreadMessageCount(userId, userRole);

    res.json({
      conversations,
      unread_count: unreadCount
    });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /advanced/chat/:appointmentId/mark-read
 * Mark messages as read
 */
router.post('/chat/:appointmentId/mark-read', requireAuth, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { id: userId } = req.session.user;
    const { role: userRole } = req.session;

    await chatModel.markMessagesAsRead(appointmentId, userId, userRole);

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/chat-dashboard
 * Render chat dashboard
 */
router.get('/chat-dashboard', requireAuth, async (req, res) => {
  try {
    const { id: userId } = req.session.user;
    const { role: userRole } = req.session;

    const conversations = await chatModel.getAppointmentsWithChats(userId, userRole);
    const unreadCount = await chatModel.getUnreadMessageCount(userId, userRole);

    res.render('advanced/chat', {
      conversations,
      unreadCount,
      userRole,
      userId
    });
  } catch (err) {
    console.error('Chat dashboard error:', err);
    res.status(500).send('Error loading chat dashboard');
  }
});

// ===== EHR ROUTES =====

/**
 * GET /advanced/ehr/:patientId
 * Get EHR summary for a patient
 */
router.get('/ehr/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const ehrSummary = await ehrModel.getEHRSummary(patientId);
    const medicalReports = await ehrModel.getPatientMedicalReports(patientId);
    const timeline = await ehrModel.getPatientEHRTimeline(patientId, 20);

    res.json({
      summary: ehrSummary,
      reports: medicalReports,
      timeline
    });
  } catch (err) {
    console.error('EHR route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/ehr-dashboard/:patientId
 * Render EHR dashboard
 */
router.get('/ehr-dashboard/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const ehrSummary = await ehrModel.getEHRSummary(patientId);
    const medicalReports = await ehrModel.getPatientMedicalReports(patientId);
    const timeline = await ehrModel.getPatientEHRTimeline(patientId, 20);

    res.render('advanced/ehr', {
      patientId,
      ehrSummary,
      medicalReports,
      timeline
    });
  } catch (err) {
    console.error('EHR dashboard error:', err);
    res.status(500).send('Error loading EHR dashboard');
  }
});

/**
 * POST /advanced/ehr/upload
 * Upload a medical report
 */
router.post('/ehr/upload', requireAuth, async (req, res) => {
  try {
    const { patientId, reportType, title, description, filePath } = req.body;
    const { id: uploadedBy } = req.session.user;

    const report = await ehrModel.uploadMedicalReport(
      patientId,
      reportType,
      title,
      description,
      filePath,
      0,
      uploadedBy
    );

    res.json({ success: true, report });
  } catch (err) {
    console.error('Upload report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ANALYTICS ROUTES =====

/**
 * GET /advanced/analytics/dashboard
 * Get complete analytics dashboard data
 */
router.get('/analytics/dashboard', requireAuth, async (req, res) => {
  try {
    // Check if user is admin or doctor
    if (!['admin', 'doctor'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dashboardData = await analyticsModel.getCompleteDashboardData();
    res.json(dashboardData);
  } catch (err) {
    console.error('Analytics dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/analytics-view
 * Render analytics dashboard
 */
router.get('/analytics-view', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'doctor'].includes(req.session.role)) {
      return res.status(403).send('Access Denied');
    }

    const dashboardData = await analyticsModel.getCompleteDashboardData();
    res.render('advanced/analytics', { dashboardData });
  } catch (err) {
    console.error('Analytics view error:', err);
    res.status(500).send('Error loading analytics');
  }
});

/**
 * GET /advanced/analytics/diseases
 * Get disease analytics
 */
router.get('/analytics/diseases', requireAuth, async (req, res) => {
  try {
    const diseases = await analyticsModel.getDiseaseAnalytics();
    res.json(diseases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/analytics/medicines
 * Get medicine analytics
 */
router.get('/analytics/medicines', requireAuth, async (req, res) => {
  try {
    const medicines = await analyticsModel.getMedicineAnalytics();
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /advanced/analytics/appointments
 * Get appointment analytics
 */
router.get('/analytics/appointments', requireAuth, async (req, res) => {
  try {
    const appointments = await analyticsModel.getAppointmentAnalytics();
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
