require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Verified assets that actually work on Stellar
const VERIFIED_ASSETS = {
  'XLM': { isNative: true },
  'USDC': {
    isNative: false,
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
  }
};

// Popular pairs that should work
const VERIFIED_PAIRS = [
  {
    baseAsset: JSON.stringify(VERIFIED_ASSETS.XLM),
    counterAsset: JSON.stringify(VERIFIED_ASSETS.USDC),
    popularityScore: 100
  }
];

async function updateVerifiedAssets() {
  console.log('🔄 Updating database with verified assets...\n');

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
    // Clear existing popular pairs
    console.log('🗑️  Clearing existing popular pairs...');
    await pool.query('DELETE FROM popular_pairs');
    console.log('✅ Cleared existing pairs');

    // Insert verified pairs
    console.log('📝 Inserting verified pairs...');
    for (const pair of VERIFIED_PAIRS) {
      await pool.query(`
        INSERT INTO popular_pairs (base_asset, counter_asset, popularity_score)
        VALUES ($1, $2, $3)
      `, [pair.baseAsset, pair.counterAsset, pair.popularityScore]);
      
      const base = JSON.parse(pair.baseAsset);
      const counter = JSON.parse(pair.counterAsset);
      const baseName = base.isNative ? 'XLM' : base.code;
      const counterName = counter.isNative ? 'XLM' : counter.code;
      console.log(`  ✅ Added ${baseName}/${counterName} (Score: ${pair.popularityScore})`);
    }

    // Clear sync status to force fresh sync
    console.log('🔄 Clearing sync status...');
    await pool.query('DELETE FROM sync_status');
    console.log('✅ Cleared sync status');

    // Show final state
    console.log('\n📊 Final Database State:');
    const finalPairs = await pool.query('SELECT * FROM popular_pairs ORDER BY popularity_score DESC');
    console.log('Popular Pairs:');
    finalPairs.rows.forEach(row => {
      console.log(`  ${row.base_asset} / ${row.counter_asset} (Score: ${row.popularity_score})`);
    });

    console.log('\n✅ Database updated successfully!');
    console.log('💡 The sync service will now only sync verified working pairs.');
    console.log('💡 You can add more verified assets later once we confirm they work.');

  } catch (error) {
    console.error('❌ Error updating database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateVerifiedAssets()
    .then(() => {
      console.log('🎉 Update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateVerifiedAssets }; 