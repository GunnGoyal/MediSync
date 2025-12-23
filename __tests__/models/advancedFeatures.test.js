/**
 * Tests for Medicine Repetition, Enhanced Health Risk, Chat, EHR, and Analytics Models
 */

const pool = require('../../config/db');
const medicineModel = require('../../models/medicineRepetitionModel');
const healthRiskModel = require('../../models/enhancedHealthRiskModel');
const chatModel = require('../../models/chatModel');
const ehrModel = require('../../models/ehrModel');
const analyticsModel = require('../../models/analyticsModel');

// Mock database
jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

describe('Medicine Repetition Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectMedicineRepetition', () => {
    it('should detect repeatedly prescribed medicines', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            medicine_name: 'Paracetamol',
            prescription_count: '6',
            associated_diseases: 'Fever',
            last_prescribed: new Date()
          }
        ]
      });

      const result = await medicineModel.detectMedicineRepetition(1);

      expect(result).toHaveLength(1);
      expect(result[0].medicine_name).toBe('Paracetamol');
      expect(result[0].prescription_count).toBe(6);
      expect(result[0].risk_level).toBe('high');
      expect(result[0].warning).toContain('risk of dependency');
    });

    it('should return empty array when no medicines', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await medicineModel.detectMedicineRepetition(1);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await medicineModel.detectMedicineRepetition(1);

      expect(result).toEqual([]);
    });
  });

  describe('getMedicineDependencyWarnings', () => {
    it('should return dependency warnings for high-risk medicines', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            medicine_name: 'Aspirin',
            prescription_count: '5',
            associated_diseases: '',
            last_prescribed: new Date(),
            risk_level: 'high'
          }
        ]
      });

      const result = await medicineModel.getMedicineDependencyWarnings(1);

      expect(result.high_risk_count).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('recommendation');
    });
  });

  describe('getMedicineUsageStats', () => {
    it('should return medicine usage statistics', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          total_unique_medicines: '5',
          total_prescriptions: '12',
          latest_prescription: new Date(),
          first_prescription: new Date('2024-01-01')
        }]
      });

      const result = await medicineModel.getMedicineUsageStats(1);

      expect(result.total_unique_medicines).toBeTruthy();
      expect(result.total_prescriptions).toBeTruthy();
    });
  });
});

describe('Enhanced Health Risk Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateEnhancedHealthRiskScore', () => {
    it('should calculate risk score with age factor', async () => {
      // Mock patient age
      pool.query.mockResolvedValueOnce({
        rows: [{ age: 65 }]
      });

      // Mock disease query
      pool.query.mockResolvedValueOnce({
        rows: [{ disease_name: 'Diabetes', count: '3' }]
      });

      // Mock medicine detection
      pool.query.mockResolvedValueOnce({
        rows: [
          { medicine_name: 'Metformin', prescription_count: '8', associated_diseases: 'Diabetes' }
        ]
      });

      // Mock doctor count
      pool.query.mockResolvedValueOnce({
        rows: [{ doctor_count: '1' }]
      });

      // Mock medicine stats
      pool.query.mockResolvedValueOnce({
        rows: [{ total_prescriptions: '8', total_unique_medicines: '2' }]
      });

      const result = await healthRiskModel.calculateEnhancedHealthRiskScore(1);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('factors');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return unknown for non-existent patient', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await healthRiskModel.calculateEnhancedHealthRiskScore(999);

      expect(result.level).toBe('unknown');
      expect(result.score).toBe(0);
    });

    it('should determine correct risk level', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ age: 30 }]
      });

      pool.query.mockResolvedValueOnce({ rows: [] });
      pool.query.mockResolvedValueOnce({ rows: [] });
      pool.query.mockResolvedValueOnce({ rows: [{ doctor_count: '1' }] });
      pool.query.mockResolvedValueOnce({
        rows: [{ total_prescriptions: '2', total_unique_medicines: '1' }]
      });

      const result = await healthRiskModel.calculateEnhancedHealthRiskScore(1);

      expect(['low', 'moderate', 'high', 'critical']).toContain(result.level);
    });
  });

  describe('getRiskLevelColor', () => {
    it('should return correct color for risk level', () => {
      expect(healthRiskModel.getRiskLevelColor('low')).toBe('#28a745');
      expect(healthRiskModel.getRiskLevelColor('critical')).toBe('#dc3545');
    });
  });

  describe('getRiskRecommendations', () => {
    it('should provide recommendations based on score', () => {
      const recs = healthRiskModel.getRiskRecommendations(75, []);

      expect(recs).toBeInstanceOf(Array);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some(r => r.includes('Urgent'))).toBe(true);
    });
  });
});

describe('Chat Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a message between patient and doctor', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          appointment_id: 1,
          patient_id: 1,
          doctor_id: 1,
          status: 'accepted'
        }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{
          message_id: 1,
          appointment_id: 1,
          sender_id: 1,
          sender_role: 'patient',
          message: 'Hello doctor',
          timestamp: new Date()
        }]
      });

      const result = await chatModel.sendMessage(1, 1, 'patient', 'Hello doctor');

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should reject unauthorized senders', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          appointment_id: 1,
          patient_id: 1,
          doctor_id: 2
        }]
      });

      await expect(chatModel.sendMessage(1, 999, 'patient', 'Hello'))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('getAppointmentMessages', () => {
    it('should retrieve all messages for an appointment', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            message_id: 1,
            sender_role: 'patient',
            message: 'Hello',
            timestamp: new Date(),
            sender_name: 'Patient Name'
          }
        ]
      });

      const result = await chatModel.getAppointmentMessages(1);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUnreadMessageCount', () => {
    it('should count unread messages for patient', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ unread_count: '3' }]
      });

      const result = await chatModel.getUnreadMessageCount(1, 'patient');

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAppointmentsWithChats', () => {
    it('should retrieve appointments with chat messages', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            appointment_id: 1,
            doctor_name: 'Dr. Smith',
            specialization: 'Cardiology',
            message_count: '5'
          }
        ]
      });

      const result = await chatModel.getAppointmentsWithChats(1, 'patient');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('EHR Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadMedicalReport', () => {
    it('should upload a medical report', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          report_id: 1,
          patient_id: 1,
          report_type: 'Lab Report',
          title: 'Blood Test',
          file_path: '/uploads/report.pdf'
        }]
      });

      pool.query.mockResolvedValueOnce({ rows: [{ timeline_id: 1 }] });

      const result = await ehrModel.uploadMedicalReport(
        1, 'Lab Report', 'Blood Test', 'Test description', '/path/to/file.pdf', 1024, 1
      );

      expect(result.report_id).toBeDefined();
    });
  });

  describe('getPatientMedicalReports', () => {
    it('should retrieve patient medical reports', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            report_id: 1,
            report_type: 'Lab',
            title: 'Blood Test',
            uploaded_at: new Date()
          }
        ]
      });

      const result = await ehrModel.getPatientMedicalReports(1);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getEHRSummary', () => {
    it('should return comprehensive EHR summary', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          patient_id: 1,
          name: 'Patient Name',
          age: 35,
          blood_group: 'O+'
        }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ disease_name: 'Diabetes', count: '2' }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ medicine_name: 'Insulin', count: '3' }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{
          appointment_id: 1,
          doctor_name: 'Dr. Smith',
          start_time: new Date()
        }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ total_reports: '5' }]
      });

      const result = await ehrModel.getEHRSummary(1);

      expect(result).toHaveProperty('patient');
      expect(result).toHaveProperty('medical_summary');
      expect(result.patient.name).toBe('Patient Name');
    });
  });
});

describe('Analytics Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDiseaseAnalytics', () => {
    it('should return disease statistics', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { disease_name: 'Diabetes', count: '15', affected_patients: '10' }
        ]
      });

      const result = await analyticsModel.getDiseaseAnalytics();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('disease_name');
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('getMedicineAnalytics', () => {
    it('should return medicine usage statistics', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { medicine_name: 'Paracetamol', prescription_count: '25', unique_patients: '15' }
        ]
      });

      const result = await analyticsModel.getMedicineAnalytics();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSystemWideStats', () => {
    it('should return system statistics', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '50' }] }); // patients
      pool.query.mockResolvedValueOnce({ rows: [{ count: '10' }] }); // doctors
      pool.query.mockResolvedValueOnce({ rows: [{ count: '100' }] }); // appointments
      pool.query.mockResolvedValueOnce({ rows: [{ count: '80' }] }); // prescriptions
      pool.query.mockResolvedValueOnce({ rows: [{ count: '30' }] }); // diseases
      pool.query.mockResolvedValueOnce({
        rows: [
          { status: 'completed', count: '50' },
          { status: 'pending', count: '30' }
        ]
      });

      const result = await analyticsModel.getSystemWideStats();

      expect(result).toHaveProperty('total_patients');
      expect(result).toHaveProperty('total_doctors');
      expect(result).toHaveProperty('total_appointments');
      expect(result.total_patients).toBe(50);
    });
  });

  describe('getCompleteDashboardData', () => {
    it('should return complete dashboard data', async () => {
      // Mock all required queries with proper response structure
      pool.query
        .mockResolvedValueOnce({ rows: [{ disease_name: 'Diabetes', count: '15' }] }) // diseases
        .mockResolvedValueOnce({ rows: [{ medicine_name: 'Aspirin', prescription_count: '20' }] }) // medicines
        .mockResolvedValueOnce({ rows: [{ status: 'completed', count: '50' }] }) // appointments
        .mockResolvedValueOnce({ rows: [{ doctor_id: 1, name: 'Dr. Smith' }] }) // doctors
        .mockResolvedValueOnce({ rows: [{ age_group: '20-30', patient_count: '15' }] }) // health risk
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // total patients
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }) // total doctors
        .mockResolvedValueOnce({ rows: [{ count: '200' }] }) // total appointments
        .mockResolvedValueOnce({ rows: [{ count: '150' }] }) // total prescriptions
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // total diseases
        .mockResolvedValueOnce({ rows: [{ status: 'completed', count: '100' }] }) // status distribution
        .mockResolvedValueOnce({ rows: [{ month: '2024-01', count: '10' }] }) // monthly trends
        .mockResolvedValueOnce({ rows: [{ specialization: 'Cardiology', doctor_count: '5' }] }); // specializations

      const result = await analyticsModel.getCompleteDashboardData();

      expect(result).toHaveProperty('system_stats');
      expect(result).toHaveProperty('disease_analytics');
      expect(result).toHaveProperty('generated_at');
    });
  });
});
