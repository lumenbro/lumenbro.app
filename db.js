const { Pool } = require('pg');
const fs = require('fs');

// Configure SSL based on environment
let sslConfig = false;
if (process.env.NODE_ENV === 'production') {
  if (process.env.SSL_CA_PATH) {
    try {
      sslConfig = { 
        ca: fs.readFileSync(process.env.SSL_CA_PATH),
        rejectUnauthorized: true
      };
    } catch (error) {
      console.warn('SSL CA file not found, using default SSL');
      sslConfig = { rejectUnauthorized: false };
    }
  } else {
    // For RDS, we can use default SSL without CA file
    sslConfig = { rejectUnauthorized: false };
  }
}

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  ssl: sslConfig
});

module.exports = pool;
