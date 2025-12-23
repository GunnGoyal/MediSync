/**
 * Health Intelligence Routes Tests
 * Tests for API endpoints
 */

const express = require('express');
const request = require('supertest');
const healthIntelligenceRoutes = require('../../routes/healthIntelligenceRoutes');

// Mock the model
jest.mock('../../models/healthIntelligenceModel', () => ({
  getHealthIntelligenceReport: jest.fn()
}));

const { getHealthIntelligenceReport } = require('../../models/healthIntelligenceModel');

const app = express();
app.use(express.json());

// Setup view engine (needed for template rendering)
app.set('view engine', 'ejs');
app.set('views', require('path').join(__dirname, '../../views'));

// Mock res.render to avoid actual template rendering
app.use((req, res, next) => {
  const originalRender = res.render;
  res.render = jest.fn((view, data, callback) => {
    // Mock render returns a simple HTML string
    res.send(`<html><body>${JSON.stringify(data)}</body></html>`);
  });
  next();
});

// Mock session middleware
app.use((req, res, next) => {
  req.session = {
    user: { id: 1, name: 'Test Patient' },
    role: 'patient'
  };
  next();
});

app.use('/health-intelligence', healthIntelligenceRoutes);

describe('Health Intelligence Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getHealthIntelligenceReport.mockResolvedValue({
      diseasePatterns: [
        {
          disease_name: 'Diabetes',
          frequency: 4,
          is_chronic: true,
          risk_assessment: 'Chronic condition'
        }
      ],
      allergyRisks: {
        prescriptionRisks: [],
        knownSideEffects: []
      },
      riskScore: {
        risk_score: 65,
        risk_level: 'high',
        calculated_at: new Date(),
        factors: {
          ageFactor: 10,
          medicineFactor: 20,
          diseaseFactor: 30,
          allergyFactor: 5
        }
      },
      recommendations: [
        {
          type: 'HIGH_RISK',
          message: 'Your health risk is high'
        }
      ]
    });
  });

  describe('GET /health-intelligence/dashboard', () => {
    it('should return 200 for authenticated patient', async () => {
      const response = await request(app)
        .get('/health-intelligence/dashboard')
        .expect('Content-Type', /html/)
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should call getHealthIntelligenceReport with patient id', async () => {
      await request(app)
        .get('/health-intelligence/dashboard')
        .expect(200);

      expect(getHealthIntelligenceReport).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      getHealthIntelligenceReport.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/health-intelligence/dashboard')
        .expect(500);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /health-intelligence/disease-patterns', () => {
    it('should return 200 for authenticated patient', async () => {
      const response = await request(app)
        .get('/health-intelligence/disease-patterns')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should call getHealthIntelligenceReport', async () => {
      await request(app)
        .get('/health-intelligence/disease-patterns')
        .expect(200);

      expect(getHealthIntelligenceReport).toHaveBeenCalled();
    });
  });

  describe('GET /health-intelligence/allergy-detection', () => {
    it('should return 200 for authenticated patient', async () => {
      const response = await request(app)
        .get('/health-intelligence/allergy-detection')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /health-intelligence/health-risk-score', () => {
    it('should return 200 for authenticated patient', async () => {
      const response = await request(app)
        .get('/health-intelligence/health-risk-score')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should display risk score of 65', async () => {
      const response = await request(app)
        .get('/health-intelligence/health-risk-score')
        .expect(200);

      expect(response.text).toContain('65');
    });
  });

  describe('GET /health-intelligence/api/report', () => {
    it('should return JSON report', async () => {
      const response = await request(app)
        .get('/health-intelligence/api/report')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('diseasePatterns');
      expect(response.body).toHaveProperty('allergyRisks');
      expect(response.body).toHaveProperty('riskScore');
      expect(response.body).toHaveProperty('recommendations');
    });

    it('should return risk score in JSON', async () => {
      const response = await request(app)
        .get('/health-intelligence/api/report')
        .expect(200);

      expect(response.body.riskScore.risk_score).toBe(65);
      expect(response.body.riskScore.risk_level).toBe('high');
    });

    it('should handle errors with JSON response', async () => {
      getHealthIntelligenceReport.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .get('/health-intelligence/api/report')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });
});
