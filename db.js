const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  ssl: { ca: fs.readFileSync(process.env.SSL_CA_PATH) }
});

module.exports = pool;
