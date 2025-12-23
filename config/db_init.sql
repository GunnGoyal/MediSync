-- Create database tables for Medisync
CREATE TABLE IF NOT EXISTS patients (
  patient_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  age INT,
  gender TEXT,
  blood_group TEXT
);

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Admin verification flag for doctors
ALTER TABLE IF EXISTS doctors ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add created_at columns to existing tables if they don't exist
ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE IF EXISTS doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id INT REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  reason TEXT,
  status TEXT CHECK (status IN ('pending','accepted','rejected','completed')) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(appointment_id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  duration TEXT NOT NULL,
  instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add side effects tracking for allergy detection
ALTER TABLE IF EXISTS prescriptions ADD COLUMN IF NOT EXISTS side_effects TEXT DEFAULT NULL;
ALTER TABLE IF EXISTS prescriptions ADD COLUMN IF NOT EXISTS reported_allergy BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS medicine_side_effects (
  effect_id SERIAL PRIMARY KEY,
  medicine_name TEXT NOT NULL,
  side_effect TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  UNIQUE(medicine_name, side_effect)
);

-- Health risk tracking for scoring
CREATE TABLE IF NOT EXISTS health_risk_score (
  risk_id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
  risk_score INT CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  factors JSONB,
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique index for one score per patient per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_risk_per_day ON health_risk_score (patient_id, DATE(calculated_at));

CREATE TABLE IF NOT EXISTS disease_history (
  history_id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
  disease_name TEXT NOT NULL,
  diagnosed_date DATE NOT NULL
);

-- Account status for patients and doctors
ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS doctors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Audit logs for system tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id SERIAL PRIMARY KEY,
  user_id INT,
  user_role TEXT NOT NULL CHECK (user_role IN ('patient','doctor','admin')),
  action TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('login','logout','create','update','delete','verify','view')),
  details TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
  config_id SERIAL PRIMARY KEY,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  system_notice TEXT,
  last_backup TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize system config
INSERT INTO system_config (maintenance_mode, system_notice) VALUES (FALSE, 'Welcome to Medisync!')
ON CONFLICT DO NOTHING;