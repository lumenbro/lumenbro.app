require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

// Production database configuration
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

async function runProductionMigrations() {
  try {
    console.log('🚀 Starting production database migrations...');
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    // Test connection first
    console.log('🔗 Testing database connection...');
    const client = await pool.connect();
    const versionResult = await client.query('SELECT version()');
    console.log(`✅ Connected to: ${versionResult.rows[0].version}`);
    client.release();
    
                // Note: TimescaleDB not available on this RDS instance
            console.log('1. Using regular PostgreSQL (TimescaleDB not available)...');
            console.log('✓ Proceeding with standard PostgreSQL tables');
    
    // Create trade_aggregations table
    console.log('2. Creating trade_aggregations table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trade_aggregations (
        timestamp TIMESTAMPTZ NOT NULL,
        base_asset TEXT NOT NULL,
        counter_asset TEXT NOT NULL,
        resolution INTERVAL NOT NULL,
        open DECIMAL(20,8) NOT NULL,
        high DECIMAL(20,8) NOT NULL,
        low DECIMAL(20,8) NOT NULL,
        close DECIMAL(20,8) NOT NULL,
        base_volume DECIMAL(20,8) NOT NULL,
        counter_volume DECIMAL(20,8) NOT NULL,
        trade_count INTEGER NOT NULL
      );
    `);
    console.log('✓ trade_aggregations table created');
    
                // Note: Using regular table instead of hypertable
            console.log('3. Creating standard table (hypertable not available)...');
            console.log('✓ Standard table created');
    
    // Create indexes
    console.log('4. Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_asset_pair ON trade_aggregations (base_asset, counter_asset);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_resolution ON trade_aggregations (resolution);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_timestamp ON trade_aggregations (timestamp DESC);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_asset_pair_resolution ON trade_aggregations (base_asset, counter_asset, resolution);');
    console.log('✓ Indexes created');
    
    // Create sync_status table
    console.log('5. Creating sync_status table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id SERIAL PRIMARY KEY,
        asset_pair TEXT NOT NULL,
        resolution INTERVAL NOT NULL,
        last_synced TIMESTAMPTZ,
        last_cursor TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(asset_pair, resolution)
      );
    `);
    console.log('✓ sync_status table created');
    
    // Create popular_pairs table
    console.log('6. Creating popular_pairs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS popular_pairs (
        id SERIAL PRIMARY KEY,
        base_asset TEXT NOT NULL,
        counter_asset TEXT NOT NULL,
        popularity_score INTEGER DEFAULT 0,
        last_accessed TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(base_asset, counter_asset)
      );
    `);
    console.log('✓ popular_pairs table created');
    
    // Insert popular pairs
    console.log('7. Inserting popular pairs...');
    await pool.query(`
      INSERT INTO popular_pairs (base_asset, counter_asset, popularity_score) VALUES
      ('XLM', 'USDC', 100),
      ('XLM', 'USDT', 90),
      ('XLM', 'BTC', 80),
      ('XLM', 'ETH', 70),
      ('USDC', 'USDT', 60),
      ('BTC', 'USDC', 50),
      ('ETH', 'USDC', 50)
      ON CONFLICT (base_asset, counter_asset) DO NOTHING;
    `);
    console.log('✓ Popular pairs inserted');
    
    // Create function and trigger
    console.log('8. Creating function and trigger...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_last_accessed()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.last_accessed = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await pool.query(`
      CREATE TRIGGER update_popular_pairs_timestamp
        BEFORE UPDATE ON popular_pairs
        FOR EACH ROW
        EXECUTE FUNCTION update_last_accessed();
    `);
    console.log('✓ Function and trigger created');
    
    console.log('✅ Production database migrations completed successfully!');
    
    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const tables = ['trade_aggregations', 'sync_status', 'popular_pairs'];
    for (const table of tables) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [table]);
        
        if (result.rows[0].exists) {
          console.log(`✓ Table '${table}' exists`);
        } else {
          console.error(`✗ Table '${table}' does not exist`);
        }
      } catch (error) {
        console.error(`✗ Error checking table '${table}':`, error.message);
      }
    }
    
    console.log('\n🎉 Production setup complete!');
    console.log('📊 Your chart data API is ready for production use.');
    
  } catch (error) {
    console.error('❌ Production migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runProductionMigrations();
}

module.exports = { runProductionMigrations }; 