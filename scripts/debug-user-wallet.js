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

async function debugUserWallet() {
  const client = await pool.connect();
  
  try {
    // Check if the API key exists in turnkey_wallets
    console.log('🔍 Checking for API key: 02d3424f01c2313dc7a3420c8baf8a3fc9b809c844f5abf51d52ab5d3d7f8bd9cd');
    
    const walletResult = await client.query(
      "SELECT * FROM turnkey_wallets WHERE public_key = $1",
      ['02d3424f01c2313dc7a3420c8baf8a3fc9b809c844f5abf51d52ab5d3d7f8bd9cd']
    );
    
    console.log('Wallet records found:', walletResult.rows.length);
    if (walletResult.rows.length > 0) {
      console.log('Wallet data:', walletResult.rows[0]);
    }
    
    // Check all turnkey_wallets records
    console.log('\n🔍 All turnkey_wallets records:');
    const allWallets = await client.query("SELECT telegram_id, turnkey_sub_org_id, public_key, is_active FROM turnkey_wallets ORDER BY telegram_id");
    console.log('Total wallets:', allWallets.rows.length);
    allWallets.rows.forEach((wallet, i) => {
      console.log(`${i + 1}. Telegram ID: ${wallet.telegram_id}, Sub-Org: ${wallet.turnkey_sub_org_id}, Public Key: ${wallet.public_key?.substring(0, 20)}..., Active: ${wallet.is_active}`);
    });
    
    // Check users table for this email
    console.log('\n🔍 Checking users table for email: bpeterscqa@gmail.com');
    const userResult = await client.query(
      "SELECT telegram_id, public_key, turnkey_user_id, user_email FROM users WHERE user_email = $1",
      ['bpeterscqa@gmail.com']
    );
    
    console.log('User records found:', userResult.rows.length);
    if (userResult.rows.length > 0) {
      console.log('User data:', userResult.rows[0]);
      
      // Check if this user has wallet records
      const userWallets = await client.query(
        "SELECT * FROM turnkey_wallets WHERE telegram_id = $1",
        [userResult.rows[0].telegram_id]
      );
      console.log('User wallet records:', userWallets.rows.length);
      if (userWallets.rows.length > 0) {
        console.log('User wallet data:', userWallets.rows[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugUserWallet();
