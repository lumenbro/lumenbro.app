// List actual users in the database to test with
require('dotenv').config();
const pool = require('../db');

async function listUsers() {
  try {
    console.log('📋 Listing users in database...');
    
    const result = await pool.query(`
      SELECT 
        u.telegram_id,
        u.user_email,
        u.turnkey_user_id,
        tw.turnkey_sub_org_id,
        tw.public_key,
        tw.is_active
      FROM users u 
      LEFT JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id 
      WHERE u.user_email IS NOT NULL 
      ORDER BY u.telegram_id DESC 
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users with emails found in database');
      console.log('💡 Register a user first through the mini-app');
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} users with emails:`);
    result.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. Telegram ID: ${user.telegram_id}`);
      console.log(`   Email: ${user.user_email}`);
      console.log(`   Sub-org: ${user.turnkey_sub_org_id}`);
      console.log(`   Active: ${user.is_active}`);
      console.log(`   Public Key: ${user.public_key?.substring(0, 20)}...`);
    });
    
    // Test with the first user
    if (result.rows.length > 0) {
      const testUser = result.rows[0];
      console.log(`\n🧪 Test OTP with: ${testUser.user_email}`);
      console.log(`   Sub-org: ${testUser.turnkey_sub_org_id}`);
    }
    
  } catch (error) {
    console.error('❌ Error listing users:', error.message);
  } finally {
    await pool.end();
  }
}

listUsers();
