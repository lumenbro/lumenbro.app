require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
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
        console.log(`✓ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Some statements might fail if they already exist (like extensions)
        if (error.message.includes('already exists') || error.message.includes('extension')) {
          console.log(`⚠ Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`✗ Statement ${i + 1} failed:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('Database migrations completed successfully!');
    
    // Verify tables exist
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
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations }; 