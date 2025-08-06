require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Helper function to convert resolution to readable format
function getResolutionName(resolution) {
  if (!resolution) return 'Unknown';
  
  let resolutionStr = resolution;
  
  // Handle different resolution formats
  if (typeof resolution === 'object' && resolution.milliseconds) {
    resolutionStr = resolution.milliseconds + 'ms';
  } else if (typeof resolution === 'number') {
    resolutionStr = resolution + 'ms';
  } else if (typeof resolution !== 'string') {
    resolutionStr = String(resolution);
  }
  
  // Convert to readable format
  const ms = parseInt(resolutionStr.replace('ms', ''));
  if (ms === 60000) return '1m';
  else if (ms === 300000) return '5m';
  else if (ms === 900000) return '15m';
  else if (ms === 3600000) return '1h';
  else if (ms === 86400000) return '1d';
  else return resolutionStr;
}

async function debugPairs() {
  console.log('🔍 Debugging Pairs and Data...\n');

  // Configure SSL for production
  let sslConfig = false;
  if (process.env.NODE_ENV === 'production') {
    const pemPath = path.join(__dirname, '..', 'global-bundle.pem');
    if (fs.existsSync(pemPath)) {
      sslConfig = {
        ca: fs.readFileSync(pemPath),
        rejectUnauthorized: true
      };
    } else {
      sslConfig = { rejectUnauthorized: false };
    }
  } else {
    sslConfig = { rejectUnauthorized: false };
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
    // Check popular pairs
    console.log('📊 Popular Pairs:');
    const popularResult = await pool.query('SELECT * FROM popular_pairs ORDER BY popularity_score DESC');
    popularResult.rows.forEach(row => {
      console.log(`  ${row.base_asset} / ${row.counter_asset} (Score: ${row.popularity_score})`);
    });
    console.log('');

    // Check sync status
    console.log('🔄 Sync Status:');
    const syncResult = await pool.query('SELECT * FROM sync_status ORDER BY updated_at DESC LIMIT 10');
    syncResult.rows.forEach(row => {
      const resolutionName = getResolutionName(row.resolution);
      console.log(`  ${row.asset_pair} - ${resolutionName} - Last: ${row.last_synced}`);
    });
    console.log('');

    // Check actual trade data
    console.log('📈 Trade Data Counts:');
    const dataResult = await pool.query(`
      SELECT 
        base_asset, 
        counter_asset, 
        resolution,
        COUNT(*) as data_points,
        MIN(timestamp) as earliest,
        MAX(timestamp) as latest
      FROM trade_aggregations 
      GROUP BY base_asset, counter_asset, resolution
      ORDER BY data_points DESC
    `);
    
    if (dataResult.rows.length === 0) {
      console.log('  ❌ No trade data found in database');
    } else {
      dataResult.rows.forEach(row => {
        const resolutionName = getResolutionName(row.resolution);
        console.log(`  ${row.base_asset} / ${row.counter_asset} (${resolutionName}): ${row.data_points} points (${row.earliest} to ${row.latest})`);
      });
    }
    console.log('');

    // Check for any errors in recent syncs
    console.log('⚠️  Recent Sync Activity:');
    const recentSyncs = await pool.query(`
      SELECT 
        asset_pair,
        resolution,
        last_synced,
        updated_at
      FROM sync_status 
      WHERE updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
    `);
    
    if (recentSyncs.rows.length === 0) {
      console.log('  ❌ No recent sync activity');
    } else {
      recentSyncs.rows.forEach(row => {
        const resolutionName = getResolutionName(row.resolution);
        console.log(`  ${row.asset_pair} - ${resolutionName} - ${row.last_synced}`);
      });
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  debugPairs();
}

module.exports = { debugPairs }; 