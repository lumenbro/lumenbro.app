require('dotenv').config();
const { Pool } = require('pg');

async function addUniqueConstraint() {
  console.log('🔧 Adding unique constraint to trade_aggregations table...');

  // Configure SSL based on environment
  let sslConfig = false;
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SSL_CA_PATH) {
      try {
        const fs = require('fs');
        sslConfig = {
          ca: fs.readFileSync(process.env.SSL_CA_PATH),
          rejectUnauthorized: true
        };
      } catch (error) {
        console.warn('SSL CA file not found, using default SSL');
        sslConfig = { rejectUnauthorized: false };
      }
    } else {
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

  try {
    // Check if constraint already exists
    const checkResult = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'trade_aggregations' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%timestamp%'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Unique constraint already exists');
      return;
    }

    // Add unique constraint
    await pool.query(`
      ALTER TABLE trade_aggregations 
      ADD CONSTRAINT trade_aggregations_unique 
      UNIQUE (timestamp, base_asset, counter_asset, resolution)
    `);

    console.log('✅ Unique constraint added successfully');

  } catch (error) {
    console.error('❌ Error adding unique constraint:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  addUniqueConstraint()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addUniqueConstraint }; 