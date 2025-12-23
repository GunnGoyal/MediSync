/**
 * Enhanced Health Risk Score System
 * Comprehensive 0-100 scoring system with multiple factors
 */

const pool = require('../config/db');
const { detectMedicineRepetition, getMedicineUsageStats } = require('./medicineRepetitionModel');

/**
 * Calculate comprehensive health risk score (0-100)
 * Factors:
 * - Age > 50: +10
 * - Repeated diseases (>= 3): +20
 * - Repeated medicines (> 4): +20
 * - Multiple doctors: +10
 * - Chronic conditions: +15
 * - Allergies/adverse effects: +15
 */
async function calculateEnhancedHealthRiskScore(patientId) {
  try {
    let score = 0;
    const factors = [];

    // Get patient age
    const patientRes = await pool.query(
      'SELECT age FROM patients WHERE patient_id = $1',
      [patientId]
    );

    if (patientRes.rows.length === 0) {
      return { score: 0, level: 'unknown', factors: [] };
    }

    const age = patientRes.rows[0].age || 0;

    // Factor 1: Age > 50
    if (age > 50) {
      score += 10;
      factors.push({
        name: 'Age Factor',
        value: age,
        points: 10,
        description: `Age ${age} exceeds threshold of 50`
      });
    }

    // Factor 2: Repeated diseases
    const diseaseRes = await pool.query(`
      SELECT disease_name, COUNT(*) as count
      FROM disease_history
      WHERE patient_id = $1
      GROUP BY disease_name
      HAVING COUNT(*) >= 3
    `, [patientId]);

    const repeatedDiseases = diseaseRes.rows.length;
    if (repeatedDiseases > 0) {
      score += 20;
      factors.push({
        name: 'Repeated Diseases',
        value: repeatedDiseases,
        points: 20,
        description: `${repeatedDiseases} disease(s) diagnosed multiple times`
      });
    }

    // Factor 3: Repeated medicines
    const medicines = await detectMedicineRepetition(patientId);
    const highRiskMedicines = medicines.filter(m => m.prescription_count > 4);
    
    if (highRiskMedicines.length > 0) {
      score += 20;
      factors.push({
        name: 'Repeated Medicines',
        value: highRiskMedicines.length,
        points: 20,
        description: `${highRiskMedicines.length} medicine(s) prescribed > 4 times`
      });
    }

    // Factor 4: Multiple doctors
    const doctorsRes = await pool.query(`
      SELECT COUNT(DISTINCT doctor_id) as doctor_count
      FROM appointments
      WHERE patient_id = $1
    `, [patientId]);

    const doctorCount = parseInt(doctorsRes.rows[0].doctor_count) || 0;
    if (doctorCount > 2) {
      score += 10;
      factors.push({
        name: 'Multiple Doctors',
        value: doctorCount,
        points: 10,
        description: `Patient seeing ${doctorCount} different doctors`
      });
    }

    // Factor 5: Chronic conditions (disease frequency >= 3)
    if (repeatedDiseases > 2) {
      score += 15;
      factors.push({
        name: 'Chronic Conditions',
        value: repeatedDiseases,
        points: 15,
        description: `Multiple chronic conditions detected`
      });
    }

    // Factor 6: Medicine usage
    const medicineStats = await getMedicineUsageStats(patientId);
    if (parseInt(medicineStats.total_prescriptions) > 10) {
      score += 15;
      factors.push({
        name: 'High Medicine Usage',
        value: medicineStats.total_prescriptions,
        points: 15,
        description: `${medicineStats.total_prescriptions} total prescriptions`
      });
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine risk level
    let level = 'low';
    if (score >= 75) level = 'critical';
    else if (score >= 50) level = 'high';
    else if (score >= 25) level = 'moderate';

    return {
      score,
      level,
      factors,
      calculated_at: new Date(),
      age,
      doctor_count: doctorCount,
      total_prescriptions: medicineStats.total_prescriptions,
      repeated_diseases: repeatedDiseases,
      high_risk_medicines: highRiskMedicines.length
    };
  } catch (err) {
    console.error('Enhanced health risk calculation error:', err);
    return {
      score: 0,
      level: 'unknown',
      factors: [],
      error: err.message
    };
  }
}

/**
 * Get risk level color code
 */
function getRiskLevelColor(level) {
  const colors = {
    low: '#28a745',      // Green
    moderate: '#ffc107',  // Yellow
    high: '#fd7e14',      // Orange
    critical: '#dc3545'   // Red
  };
  return colors[level] || '#6c757d'; // Default gray
}

/**
 * Get risk recommendations based on score
 */
function getRiskRecommendations(score, factors) {
  const recommendations = [];

  if (score === 0) {
    recommendations.push('Continue maintaining good health practices');
  }

  if (score >= 25) {
    recommendations.push('Schedule regular health checkups');
  }

  if (score >= 50) {
    recommendations.push('Consider comprehensive health evaluation');
    recommendations.push('Review current medications with doctor');
    recommendations.push('Increase frequency of medical visits');
  }

  if (score >= 75) {
    recommendations.push('⚠️ Urgent health intervention needed');
    recommendations.push('Schedule immediate consultation with specialist');
    recommendations.push('Consider hospitalization/detailed testing');
  }

  // Age-specific recommendations
  const ageFactors = factors.filter(f => f.name === 'Age Factor');
  if (ageFactors.length > 0) {
    recommendations.push('Age-appropriate preventive screening recommended');
  }

  // Medicine-specific recommendations
  const medicineFactors = factors.filter(f => f.name === 'Repeated Medicines');
  if (medicineFactors.length > 0) {
    recommendations.push('Review medicine dependency risks with healthcare provider');
    recommendations.push('Consider medicine rotation or alternatives');
  }

  return recommendations;
}

module.exports = {
  calculateEnhancedHealthRiskScore,
  getRiskLevelColor,
  getRiskRecommendations
};
