/**
 * Health Intelligence Model Tests
 * Tests for disease detection, allergy detection, and risk scoring
 */

const {
  detectDiseasePatterns,
  detectAllergyRisks,
  calculateHealthRiskScore,
  getHealthIntelligenceReport
} = require('../../models/healthIntelligenceModel');

// Mock the database pool
jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

const pool = require('../../config/db');

describe('Health Intelligence Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectDiseasePatterns', () => {
    it('should return empty array for patient with no disease history', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      
      const result = await detectDiseasePatterns(1);
      
      expect(result).toEqual([]);
      expect(pool.query).toHaveBeenCalled();
    });

    it('should mark disease as chronic if frequency >= 3', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            disease_name: 'Diabetes',
            frequency: 4,
            first_occurrence: '2024-07-01',
            last_occurrence: '2024-12-01'
          }
        ]
      });

      const result = await detectDiseasePatterns(1);

      expect(result).toHaveLength(1);
      expect(result[0].is_chronic).toBe(true);
      expect(result[0].disease_name).toBe('Diabetes');
      expect(result[0].frequency).toBe(4);
    });

    it('should mark disease as recurring if frequency < 3', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            disease_name: 'Migraine',
            frequency: 2,
            first_occurrence: '2024-10-01',
            last_occurrence: '2024-11-01'
          }
        ]
      });

      const result = await detectDiseasePatterns(1);

      expect(result[0].is_chronic).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await detectDiseasePatterns(1);

      expect(result).toEqual([]);
    });
  });

  describe('detectAllergyRisks', () => {
    it('should return empty arrays for patient with no allergies', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // prescriptionRisks
        .mockResolvedValueOnce({ rows: [] }); // knownSideEffects

      const result = await detectAllergyRisks(1);

      expect(result.prescriptionRisks).toEqual([]);
      expect(result.knownSideEffects).toEqual([]);
    });

    it('should detect medicines with reported allergies', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              medicine_name: 'Aspirin',
              dosage: '500mg',
              times_prescribed: 3,
              allergy_reports: 2,
              reported_side_effects: ['Rash']
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await detectAllergyRisks(1);

      expect(result.prescriptionRisks).toHaveLength(1);
      expect(result.prescriptionRisks[0].medicine_name).toBe('Aspirin');
      expect(result.prescriptionRisks[0].allergy_reports).toBe(2);
    });

    it('should detect medicines with known side effects', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              medicine_name: 'Ibuprofen',
              side_effect: 'Stomach upset',
              severity: 'moderate'
            }
          ]
        });

      const result = await detectAllergyRisks(1);

      expect(result.knownSideEffects).toHaveLength(1);
      expect(result.knownSideEffects[0].medicine_name).toBe('Ibuprofen');
      expect(result.knownSideEffects[0].severity).toBe('moderate');
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await detectAllergyRisks(1);

      expect(result.prescriptionRisks).toEqual([]);
      expect(result.knownSideEffects).toEqual([]);
    });
  });

  describe('calculateHealthRiskScore', () => {
    it('should calculate low risk score for healthy patient', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ age: 25 }] })
        .mockResolvedValueOnce({ rows: [{ total_prescriptions: 1, unique_medicines: 1 }] })
        .mockResolvedValueOnce({ rows: [{ total_diseases: 1, unique_diseases: 1, max_single_disease: 1 }] })
        .mockResolvedValueOnce({ rows: [{ allergy_incidents: 0 }] });

      const result = await calculateHealthRiskScore(1);

      expect(result.score).toBeLessThan(40);
      expect(result.level).toBe('low');
    });

    it('should calculate high risk score for patient with many conditions', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ age: 65 }] })
        .mockResolvedValueOnce({ rows: [{ total_prescriptions: 12, unique_medicines: 8 }] })
        .mockResolvedValueOnce({ rows: [{ total_diseases: 6, unique_diseases: 5, max_single_disease: 4 }] })
        .mockResolvedValueOnce({ rows: [{ allergy_incidents: 3 }] });

      const result = await calculateHealthRiskScore(1);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(['high', 'critical']).toContain(result.level);
    });

    it('should cap score at 100', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ age: 80 }] })
        .mockResolvedValueOnce({ rows: [{ total_prescriptions: 50, unique_medicines: 20 }] })
        .mockResolvedValueOnce({ rows: [{ total_diseases: 20, unique_diseases: 15, max_single_disease: 5 }] })
        .mockResolvedValueOnce({ rows: [{ allergy_incidents: 10 }] });

      const result = await calculateHealthRiskScore(1);

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should add chronic bonus for high frequency disease', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ age: 50 }] })
        .mockResolvedValueOnce({ rows: [{ total_prescriptions: 5, unique_medicines: 3 }] })
        .mockResolvedValueOnce({ rows: [{ total_diseases: 3, unique_diseases: 2, max_single_disease: 4 }] })
        .mockResolvedValueOnce({ rows: [{ allergy_incidents: 0 }] });

      const result = await calculateHealthRiskScore(1);

      // Should include chronic bonus of +10
      expect(result.breakdown).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await calculateHealthRiskScore(1);

      expect(result.score).toBe(0);
      expect(result.level).toBe('unknown');
    });
  });

  describe('getHealthIntelligenceReport', () => {
    it('should return complete report with all components', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // disease patterns
        .mockResolvedValueOnce({ rows: [] }) // prescription risks
        .mockResolvedValueOnce({ rows: [] }) // known side effects
        .mockResolvedValueOnce({ rows: [{ age: 40 }] }) // age
        .mockResolvedValueOnce({ rows: [{ total_prescriptions: 5, unique_medicines: 3 }] }) // medicines
        .mockResolvedValueOnce({ rows: [{ total_diseases: 2, unique_diseases: 2, max_single_disease: 2 }] }) // diseases
        .mockResolvedValueOnce({ rows: [{ allergy_incidents: 0 }] }); // allergies

      const result = await getHealthIntelligenceReport(1);

      expect(result).toHaveProperty('diseasePatterns');
      expect(result).toHaveProperty('allergyRisks');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.diseasePatterns)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle errors and return default structure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await getHealthIntelligenceReport(1);

      expect(result.diseasePatterns).toEqual([]);
      expect(result.allergyRisks.prescriptionRisks).toEqual([]);
      expect(result.allergyRisks.knownSideEffects).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });
  });
});
