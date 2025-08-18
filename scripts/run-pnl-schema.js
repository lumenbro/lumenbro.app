require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runPnlSchema() {
  try {
    console.log('📊 Running P&L schema migration...');
    console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    // Test connection first
    console.log('🔗 Testing database connection...');
    const client = await pool.connect();
    const versionResult = await client.query('SELECT version()');
    console.log(`✅ Connected to: ${versionResult.rows[0].version}`);
    client.release();
    
    // Read the P&L schema file
    const schemaPath = path.join(__dirname, '../db/positions_pnl.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Loading P&L schema...');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .map(stmt => stmt + ';'); // Add semicolon back
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await pool.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Some statements might fail if they already exist
        if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
          console.log(`⚠ Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('🎉 P&L schema migration completed successfully!');
    
    // Verify tables exist
    const tables = ['user_positions', 'user_trades', 'asset_prices', 'pnl_snapshots', 'realized_pnl'];
    console.log('🔍 Verifying tables...');
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✅ ${table}: ${result.rows[0].count} rows`);
      } catch (error) {
        console.error(`❌ ${table}: ${error.message}`);
      }
    }
    
    // Test the functions
    console.log('🔍 Testing database functions...');
    try {
      // Test the update_position_after_trade function
      await pool.query('SELECT update_position_after_trade(123456, \'TEST\', NULL, \'buy\', 100.0, 0.1, 10.0)');
      console.log('✅ update_position_after_trade function works');
      
      // Test the calculate_position_pnl function
      await pool.query('SELECT calculate_position_pnl(1, 0.12)');
      console.log('✅ calculate_position_pnl function works');
      
    } catch (error) {
      console.log('⚠ Function test failed (expected if no test data):', error.message);
    }
    
  } catch (error) {
    console.error('❌ P&L schema migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runPnlSchema();
