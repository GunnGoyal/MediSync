const pool = require('../config/db');

/**
 * Detect repeating diseases over the past 6 months
 * Shows chronic pattern trends
 */
async function detectDiseasePatterns(patient_id) {
  try {
    const { rows } = await pool.query(
      `SELECT disease_name, COUNT(*)::int as frequency, 
              MIN(diagnosed_date) as first_occurrence,
              MAX(diagnosed_date) as last_occurrence
       FROM disease_history
       WHERE patient_id = $1 
       AND diagnosed_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY disease_name
       ORDER BY frequency DESC`,
      [patient_id]
    );
    
    return rows.map(disease => ({
      ...disease,
      is_chronic: disease.frequency >= 3,
      risk_assessment: disease.frequency >= 3 
        ? 'Possible chronic condition - recommend specialist consultation'
        : disease.frequency === 2 
        ? 'Recurring pattern detected - monitor closely'
        : 'Single occurrence - standard monitoring'
    }));
  } catch (err) {
    console.error('Disease pattern detection error:', err);
    return [];
  }
}

/**
 * Detect medicines that may cause side effects or allergies
 * Auto-flags potential drug interactions and allergies
 */
async function detectAllergyRisks(patient_id) {
  try {
    // Get medicines prescribed to patient with reported side effects
    const { rows: prescriptionRisks } = await pool.query(
      `SELECT DISTINCT pr.medicine_name, pr.dosage,
              COUNT(*)::int as times_prescribed,
              SUM(CASE WHEN pr.reported_allergy = true THEN 1 ELSE 0 END)::int as allergy_reports,
              ARRAY_AGG(DISTINCT pr.side_effects) FILTER (WHERE pr.side_effects IS NOT NULL) as reported_side_effects
       FROM prescriptions pr
       JOIN appointments a ON pr.appointment_id = a.appointment_id
       WHERE a.patient_id = $1
       GROUP BY pr.medicine_name, pr.dosage
       HAVING SUM(CASE WHEN pr.reported_allergy = true THEN 1 ELSE 0 END) > 0
          OR COUNT(*)::int >= 4`,
      [patient_id]
    );

    // Get known side effects for medicines patient has taken
    const { rows: knownSideEffects } = await pool.query(
      `SELECT DISTINCT pr.medicine_name, mse.side_effect, mse.severity
       FROM prescriptions pr
       JOIN medicine_side_effects mse ON pr.medicine_name = mse.medicine_name
       JOIN appointments a ON pr.appointment_id = a.appointment_id
       WHERE a.patient_id = $1
       ORDER BY mse.severity DESC`,
      [patient_id]
    );

    return {
      prescriptionRisks: prescriptionRisks.map(risk => ({
        ...risk,
        risk_level: risk.allergy_reports > 0 ? 'ALLERGY_ALERT' : 'FREQUENCY_WARNING',
        action: risk.allergy_reports > 0 
          ? `⚠️ ALLERGY RISK: ${risk.medicine_name} has ${risk.allergy_reports} allergy report(s)`
          : `⚠️ HIGH FREQUENCY: ${risk.medicine_name} prescribed ${risk.times_prescribed} times`
      })),
      knownSideEffects: knownSideEffects.map(effect => ({
        ...effect,
        alert_level: effect.severity === 'severe' ? 'CRITICAL' : effect.severity === 'moderate' ? 'WARNING' : 'INFO'
      }))
    };
  } catch (err) {
    console.error('Allergy detection error:', err);
    return { prescriptionRisks: [], knownSideEffects: [] };
  }
}

/**
 * Calculate health risk score (0-100) based on:
 * - Medicine frequency (repetition)
 * - Disease repetition patterns
 * - Age
 * - Allergy/side effect history
 */
async function calculateHealthRiskScore(patient_id) {
  try {
    // Get patient age
    const { rows: patientData } = await pool.query(
      'SELECT age FROM patients WHERE patient_id = $1',
      [patient_id]
    );
    
    const age = patientData[0]?.age || 30;

    // Count medicine frequency (last 2 months)
    const { rows: medicineFreq } = await pool.query(
      `SELECT COUNT(*)::int as total_prescriptions,
              COUNT(DISTINCT medicine_name)::int as unique_medicines
       FROM prescriptions pr
       JOIN appointments a ON pr.appointment_id = a.appointment_id
       WHERE a.patient_id = $1 
       AND pr.created_at >= CURRENT_DATE - INTERVAL '2 months'`,
      [patient_id]
    );

    // Count disease frequency (last 6 months)
    const { rows: diseaseFreq } = await pool.query(
      `SELECT COUNT(*)::int as total_diseases,
              COUNT(DISTINCT disease_name)::int as unique_diseases,
              COALESCE((SELECT MAX(disease_count) FROM (
                SELECT COUNT(*)::int as disease_count
                FROM disease_history
                WHERE patient_id = $1 
                AND diagnosed_date >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY disease_name
              ) subq), 0)::int as max_single_disease
       FROM disease_history
       WHERE patient_id = $1 
       AND diagnosed_date >= CURRENT_DATE - INTERVAL '6 months'`,
      [patient_id]
    );

    // Count allergy/side effect incidents
    const { rows: allergyCount } = await pool.query(
      `SELECT COUNT(*)::int as allergy_incidents
       FROM prescriptions pr
       JOIN appointments a ON pr.appointment_id = a.appointment_id
       WHERE a.patient_id = $1 
       AND pr.reported_allergy = true`,
      [patient_id]
    );

    // Calculate score components (0-100)
    let score = 0;
    const factors = {};

    // Factor 1: Age (max 15 points, older = higher risk)
    const ageFactor = Math.min(15, Math.floor((age / 80) * 15));
    score += ageFactor;
    factors.age_factor = { value: ageFactor, description: `Age (${age} years): +${ageFactor}` };

    // Factor 2: Medicine repetition (max 30 points)
    const totalPrescriptions = medicineFreq[0]?.total_prescriptions || 0;
    const uniqueMedicines = medicineFreq[0]?.unique_medicines || 0;
    const medicineFactor = Math.min(30, Math.floor((totalPrescriptions / 10) * 30));
    score += medicineFactor;
    factors.medicine_factor = { 
      value: medicineFactor, 
      description: `High medicine usage (${totalPrescriptions} prescriptions): +${medicineFactor}` 
    };

    // Factor 3: Disease repetition (max 25 points)
    const totalDiseases = diseaseFreq[0]?.total_diseases || 0;
    const maxSingleDisease = diseaseFreq[0]?.max_single_disease || 0;
    const diseaseFactor = Math.min(25, Math.floor((totalDiseases / 8) * 25));
    score += diseaseFactor;
    if (maxSingleDisease >= 3) {
      score += 10; // Bonus for chronic condition
      factors.chronic_condition = { value: 10, description: 'Chronic disease detected: +10' };
    }
    factors.disease_factor = { 
      value: diseaseFactor, 
      description: `Disease frequency (${totalDiseases} diagnosed): +${diseaseFactor}` 
    };

    // Factor 4: Allergy/Side effects (max 20 points)
    const allergyIncidents = allergyCount[0]?.allergy_incidents || 0;
    const allergyFactor = Math.min(20, allergyIncidents * 5);
    score += allergyFactor;
    factors.allergy_factor = { 
      value: allergyFactor, 
      description: `Allergy incidents (${allergyIncidents}): +${allergyFactor}` 
    };

    // Final score cap at 100
    const finalScore = Math.min(100, score);

    // Determine risk level
    let riskLevel = 'low';
    let riskDescription = '✅ Your health is in good condition';
    
    if (finalScore >= 80) {
      riskLevel = 'critical';
      riskDescription = '🔴 CRITICAL: Immediate medical attention recommended';
    } else if (finalScore >= 60) {
      riskLevel = 'high';
      riskDescription = '🟡 HIGH RISK: Schedule specialist consultation';
    } else if (finalScore >= 40) {
      riskLevel = 'moderate';
      riskDescription = '🟠 MODERATE: Monitor health patterns closely';
    } else if (finalScore >= 20) {
      riskLevel = 'low';
      riskDescription = '🟢 LOW RISK: Continue regular check-ups';
    }

    factors.summary = riskDescription;

    // Save risk score to database
    await pool.query(
      `INSERT INTO health_risk_score (patient_id, risk_score, risk_level, factors)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (patient_id, calculated_at::DATE) DO UPDATE SET
       risk_score = $2, risk_level = $3, factors = $4`,
      [patient_id, finalScore, riskLevel, JSON.stringify(factors)]
    );

    return {
      score: finalScore,
      level: riskLevel,
      description: riskDescription,
      factors,
      breakdown: {
        age_factor: ageFactor,
        medicine_factor: medicineFactor,
        disease_factor: diseaseFactor,
        allergy_factor: allergyFactor,
        chronic_bonus: factors.chronic_condition ? 10 : 0
      }
    };
  } catch (err) {
    console.error('Health risk score calculation error:', err);
    return {
      score: 0,
      level: 'unknown',
      description: 'Unable to calculate risk score',
      factors: {}
    };
  }
}

/**
 * Get comprehensive health intelligence report
 */
async function getHealthIntelligenceReport(patient_id) {
  try {
    const diseasePatterns = await detectDiseasePatterns(patient_id);
    const allergyRisks = await detectAllergyRisks(patient_id);
    const healthScoreData = await calculateHealthRiskScore(patient_id);

    // Transform healthScore to riskScore format for EJS templates
    const riskScore = {
      risk_score: healthScoreData.score,
      risk_level: healthScoreData.level,
      calculated_at: new Date(),
      factors: {
        ageFactor: healthScoreData.breakdown.age_factor,
        medicineFactor: healthScoreData.breakdown.medicine_factor,
        diseaseFactor: healthScoreData.breakdown.disease_factor,
        allergyFactor: healthScoreData.breakdown.allergy_factor,
        totalPrescriptions: healthScoreData.factors.medicine_factor ? 
          Math.round((healthScoreData.breakdown.medicine_factor / 30) * 10) : 0,
        totalDiseases: healthScoreData.factors.disease_factor ? 
          Math.round((healthScoreData.breakdown.disease_factor / 25) * 8) : 0,
        chronicCount: healthScoreData.factors.chronic_condition ? 1 : 0,
        allergyIncidents: healthScoreData.breakdown.allergy_factor / 5
      }
    };

    return {
      diseasePatterns,
      allergyRisks,
      riskScore,
      recommendations: generateRecommendations(diseasePatterns, allergyRisks, healthScoreData)
    };
  } catch (err) {
    console.error('Health intelligence report error:', err);
    return {
      diseasePatterns: [],
      allergyRisks: { prescriptionRisks: [], knownSideEffects: [] },
      riskScore: { risk_score: 0, risk_level: 'unknown', calculated_at: new Date(), factors: {} },
      recommendations: []
    };
  }
}

/**
 * Generate personalized health recommendations based on analysis
 */
function generateRecommendations(diseasePatterns, allergyRisks, healthScore) {
  const recommendations = [];

  // Disease-based recommendations
  diseasePatterns.forEach(disease => {
    if (disease.is_chronic) {
      recommendations.push({
        type: 'CHRONIC_DISEASE',
        priority: 'HIGH',
        message: `You have been diagnosed with ${disease.disease_name} ${disease.frequency} times. Consider consulting a specialist for chronic disease management.`,
        icon: '🏥'
      });
    }
  });

  // Allergy-based recommendations
  if (allergyRisks.prescriptionRisks.length > 0) {
    allergyRisks.prescriptionRisks.forEach(risk => {
      if (risk.risk_level === 'ALLERGY_ALERT') {
        recommendations.push({
          type: 'ALLERGY_WARNING',
          priority: 'CRITICAL',
          message: `⚠️ ALERT: ${risk.medicine_name} has triggered allergic reactions. Inform your doctor before it's prescribed again.`,
          icon: '⚠️'
        });
      }
    });
  }

  // Risk score recommendations
  if (healthScore.level === 'critical') {
    recommendations.push({
      type: 'CRITICAL_HEALTH',
      priority: 'CRITICAL',
      message: 'Your health risk score is critical. Schedule an urgent appointment with your doctor.',
      icon: '🚨'
    });
  } else if (healthScore.level === 'high') {
    recommendations.push({
      type: 'HIGH_RISK',
      priority: 'HIGH',
      message: 'Your health risk score indicates elevated risk. Please consult with a healthcare professional.',
      icon: '⚠️'
    });
  }

  // Medicine-based recommendations
  if (healthScore.breakdown.medicine_factor > 20) {
    recommendations.push({
      type: 'HIGH_MEDICINE_USE',
      priority: 'MEDIUM',
      message: 'You are taking multiple medicines frequently. Discuss with your doctor about possible interactions and long-term effects.',
      icon: '💊'
    });
  }

  return recommendations.sort((a, b) => {
    const priorityMap = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityMap[a.priority] - priorityMap[b.priority];
  });
}

module.exports = {
  detectDiseasePatterns,
  detectAllergyRisks,
  calculateHealthRiskScore,
  getHealthIntelligenceReport
};
