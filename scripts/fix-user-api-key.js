const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixUserApiKey() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking current user data...');
    
    // Get current user data
    const userResult = await client.query(
      "SELECT tw.*, u.user_email FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE u.user_email = $1",
      ['bpeterscqa@gmail.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Current user data:', {
      telegram_id: user.telegram_id,
      sub_org_id: user.turnkey_sub_org_id,
      stellar_public_key: user.public_key,
      turnkey_api_public_key: user.turnkey_api_public_key,
      email: user.user_email
    });
    
    // The issue is that the user was registered with the Stellar wallet key
    // but we need to re-register them with the Turnkey API key
    console.log('\n🔧 Solution: User needs to be re-registered with the correct API key');
    console.log('The Turnkey API key needs to be registered with the sub-organization');
    
    console.log('\n📋 Manual steps needed:');
    console.log('1. User should re-register through the mini-app');
    console.log('2. This will create a new sub-organization with the correct API key');
    console.log('3. Or manually update the Turnkey sub-organization via API');
    
    console.log('\n🔑 Current API key that should be registered:', user.turnkey_api_public_key);
    console.log('🏢 Sub-organization ID:', user.turnkey_sub_org_id);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixUserApiKey();
