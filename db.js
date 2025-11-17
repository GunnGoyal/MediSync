const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Database helper functions
const db = {
  // Execute a query with parameters
  async query(text, params) {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  },

  // Get a client from the pool for transactions
  async getClient() {
    return await pool.connect();
  },

  // Test database connection
  async testConnection() {
    try {
      const result = await this.query('SELECT NOW() as current_time, version() as version');
      console.log('✅ Database connection test successful');
      return result.rows[0];
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      throw error;
    }
  }
};

module.exports = db;