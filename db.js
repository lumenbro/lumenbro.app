const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configure SSL based on environment
let sslConfig = false;
if (process.env.NODE_ENV === 'production') {
  const pemPath = path.join(__dirname, 'global-bundle.pem');
  if (fs.existsSync(pemPath)) {
    sslConfig = {
      ca: fs.readFileSync(pemPath),
      rejectUnauthorized: true
    };
    console.log('✅ Using SSL certificate from global-bundle.pem');
  } else {
    console.warn('⚠️  global-bundle.pem not found, using default SSL');
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
