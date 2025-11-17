const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'hospital_management',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database tables...');
    
    // Create appointments table with status column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(id),
        doctor_id INT REFERENCES doctors(id),
        appointment_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Appointments table created successfully!');
    
    // Add status column if it doesn't exist (for existing tables)
    try {
      await pool.query(`
        ALTER TABLE appointments 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
      `);
      console.log('✅ Status column added to appointments table!');
    } catch (err) {
      console.log('ℹ️  Status column already exists or error:', err.message);
    }
    
    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Existing tables:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    console.log('\n✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    process.exit(1);
  }
}

setupDatabase();
