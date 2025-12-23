/**
 * Seed script: populates test data for Medisync
 * Run: node scripts/seed.js
 */
require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    console.log('🌱 Seeding test data...\n');

    // Create tables if not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        patient_id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        age INT,
        gender TEXT,
        blood_group TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        doctor_id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        appointment_id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
        doctor_id INT REFERENCES doctors(doctor_id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        reason TEXT,
        status TEXT CHECK (status IN ('pending','accepted','rejected','completed')) DEFAULT 'pending'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        prescription_id SERIAL PRIMARY KEY,
        appointment_id INT REFERENCES appointments(appointment_id) ON DELETE CASCADE,
        medicine_name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        duration TEXT NOT NULL,
        instructions TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS disease_history (
        history_id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
        disease_name TEXT NOT NULL,
        diagnosed_date DATE NOT NULL
      );
    `);

    console.log('✅ Tables created/verified.\n');

    // Clear existing data
    await pool.query('DELETE FROM disease_history');
    await pool.query('DELETE FROM prescriptions');
    await pool.query('DELETE FROM appointments');
    await pool.query('DELETE FROM patients');
    await pool.query('DELETE FROM doctors');

    // Seed patients
    const patientHash1 = await bcrypt.hash('patient123', 10);
    const patientHash2 = await bcrypt.hash('patient123', 10);

    const p1 = await pool.query(
      `INSERT INTO patients(name,email,password,age,gender,blood_group) VALUES($1,$2,$3,$4,$5,$6) RETURNING patient_id`,
      ['Rahul Kumar', 'rahul@example.com', patientHash1, 28, 'M', 'O+']
    );
    const patientId1 = p1.rows[0].patient_id;

    const p2 = await pool.query(
      `INSERT INTO patients(name,email,password,age,gender,blood_group) VALUES($1,$2,$3,$4,$5,$6) RETURNING patient_id`,
      ['Priya Singh', 'priya@example.com', patientHash2, 35, 'F', 'A+']
    );
    const patientId2 = p2.rows[0].patient_id;

    console.log(`✅ Seeded 2 patients (patient123 / patient123)\n`);

    // Seed doctors
    const docHash1 = await bcrypt.hash('doctor123', 10);
    const docHash2 = await bcrypt.hash('doctor123', 10);

    const d1 = await pool.query(
      `INSERT INTO doctors(name,specialization,email,password,is_verified) VALUES($1,$2,$3,$4,$5) RETURNING doctor_id`,
      ['Dr. Amit Sharma', 'Cardiology', 'amit@example.com', docHash1, true]
    );
    const doctorId1 = d1.rows[0].doctor_id;

    const d2 = await pool.query(
      `INSERT INTO doctors(name,specialization,email,password,is_verified) VALUES($1,$2,$3,$4,$5) RETURNING doctor_id`,
      ['Dr. Neha Gupta', 'Neurology', 'neha@example.com', docHash2, true]
    );
    const doctorId2 = d2.rows[0].doctor_id;

    console.log(`✅ Seeded 2 doctors (doctor123 / doctor123)\n`);

    // Seed appointments
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    start.setHours(10, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(10, 30, 0);

    const a1 = await pool.query(
      `INSERT INTO appointments(patient_id,doctor_id,start_time,end_time,reason,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING appointment_id`,
      [patientId1, doctorId1, start, end, 'Heart checkup', 'accepted']
    );
    const appointmentId1 = a1.rows[0].appointment_id;

    console.log(`✅ Seeded 1 appointment (accepted)\n`);

    // Seed prescriptions
    await pool.query(
      `INSERT INTO prescriptions(appointment_id,medicine_name,dosage,duration,instructions) VALUES($1,$2,$3,$4,$5)`,
      [appointmentId1, 'Aspirin', '100mg', '10 days', 'Take once daily after breakfast']
    );

    await pool.query(
      `INSERT INTO prescriptions(appointment_id,medicine_name,dosage,duration,instructions) VALUES($1,$2,$3,$4,$5)`,
      [appointmentId1, 'Paracetamol', '500mg', '5 days', 'Take as needed']
    );

    console.log(`✅ Seeded 2 prescriptions\n`);

    // Seed disease history
    await pool.query(
      `INSERT INTO disease_history(patient_id,disease_name,diagnosed_date) VALUES($1,$2,$3)`,
      [patientId1, 'Hypertension', new Date('2024-01-15')]
    );

    await pool.query(
      `INSERT INTO disease_history(patient_id,disease_name,diagnosed_date) VALUES($1,$2,$3)`,
      [patientId1, 'Type 2 Diabetes', new Date('2023-06-20')]
    );

    console.log(`✅ Seeded 2 disease history records\n`);

    console.log('═══════════════════════════════════════════════');
    console.log('🎉 SEED COMPLETE! Test accounts created:\n');
    console.log('👤 PATIENT:');
    console.log('   Email: rahul@example.com / Password: patient123');
    console.log('   Email: priya@example.com / Password: patient123\n');
    console.log('👨‍⚕️  DOCTOR:');
    console.log('   Email: amit@example.com / Password: doctor123');
    console.log('   Email: neha@example.com / Password: doctor123\n');
    console.log('🛡️  ADMIN:');
    console.log('   Username: admin / Password: admin123\n');
    console.log('═══════════════════════════════════════════════');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
