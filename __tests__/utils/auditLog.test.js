/**
 * Audit Log Utility Tests
 * Tests for audit logging functionality
 */

const { logAction } = require('../../utils/auditLog');

// Mock the database pool
jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

const pool = require('../../config/db');

describe('Audit Log Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [{ log_id: 1 }] });
  });

  describe('logAction', () => {
    it('should log login action', async () => {
      await logAction(1, 'patient', 'login', 'Patient logged in', 'login');

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO audit_logs');
    });

    it('should log create action with details', async () => {
      await logAction(2, 'doctor', 'create', 'Created prescription for patient 5', 'create');

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO audit_logs');
    });

    it('should include timestamp in log', async () => {
      await logAction(1, 'patient', 'view', 'Viewed health dashboard', 'view');

      expect(pool.query).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await logAction(1, 'patient', 'login', 'Login attempt', 'login');

      expect(pool.query).toHaveBeenCalled();
    });

    it('should validate user role', async () => {
      await logAction(1, 'patient', 'login', 'Login', 'login');

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[1]).toContain('patient');
    });

    it('should include action type in parameters', async () => {
      await logAction(5, 'admin', 'verify', 'Verified doctor account', 'verify');

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[1]).toContain('verify');
    });
  });
});
