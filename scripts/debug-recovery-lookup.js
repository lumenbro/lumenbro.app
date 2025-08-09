#!/usr/bin/env node
require('dotenv').config();
const pool = require('../db');

async function debugRecoveryLookup() {
  const testEmail = 'bpeterscqa@gmail.com'; // Your test email
  
  console.log('🔍 Debugging recovery lookup for email:', testEmail);
  
  try {
    // Check if user exists with this email
    console.log('\n1. Checking users table...');
    const userCheck = await pool.query(
      "SELECT telegram_id, user_email, turnkey_user_id FROM users WHERE user_email = $1",
      [testEmail]
    );
    console.log('Users found:', userCheck.rows);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ No user found with this email');
      
      // Check for case-insensitive matches
      console.log('\n2. Checking case-insensitive...');
      const caseInsensitiveCheck = await pool.query(
        "SELECT telegram_id, user_email, turnkey_user_id FROM users WHERE LOWER(user_email) = LOWER($1)",
        [testEmail]
      );
      console.log('Case-insensitive matches:', caseInsensitiveCheck.rows);
      
      if (caseInsensitiveCheck.rows.length === 0) {
        console.log('❌ No user found even with case-insensitive search');
        
        // Show all users to see what's in the database
        console.log('\n3. Showing all users in database...');
        const allUsers = await pool.query(
          "SELECT telegram_id, user_email, turnkey_user_id FROM users LIMIT 10"
        );
        console.log('All users:', allUsers.rows);
        return;
      }
    }
    
    const users = userCheck.rows.length > 0 ? userCheck.rows : caseInsensitiveCheck.rows;
    
    // Check turnkey_wallets for these users
    console.log('\n4. Checking turnkey_wallets table...');
    for (const user of users) {
      console.log(`\n--- User ${user.telegram_id} (${user.user_email}) ---`);
      
      const walletCheck = await pool.query(
        "SELECT turnkey_sub_org_id, turnkey_key_id, public_key, is_active FROM turnkey_wallets WHERE telegram_id = $1",
        [user.telegram_id]
      );
      console.log('Wallets found:', walletCheck.rows);
      
      if (walletCheck.rows.length > 0) {
        const activeWallets = walletCheck.rows.filter(w => w.is_active);
        console.log('Active wallets:', activeWallets.length);
        
        if (activeWallets.length > 0) {
          console.log('✅ Active sub-org found:', activeWallets[0].turnkey_sub_org_id);
        } else {
          console.log('⚠️ Wallets exist but none are active');
        }
      } else {
        console.log('❌ No wallets found for this user');
      }
    }
    
    // Test the exact query used in recovery.js
    console.log('\n5. Testing exact recovery lookup query...');
    const recoveryQuery = await pool.query(
      "SELECT tw.turnkey_sub_org_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE u.user_email = $1 AND tw.is_active = TRUE",
      [testEmail.trim().toLowerCase()]
    );
    console.log('Recovery query result:', recoveryQuery.rows);
    
    if (recoveryQuery.rows.length > 0) {
      console.log('✅ Recovery lookup should work! Sub-org ID:', recoveryQuery.rows[0].turnkey_sub_org_id);
    } else {
      console.log('❌ Recovery lookup failed - this is the problem!');
      
      // Try without the active filter
      console.log('\n6. Trying without active filter...');
      const noActiveFilter = await pool.query(
        "SELECT tw.turnkey_sub_org_id, tw.is_active FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE u.user_email = $1",
        [testEmail.trim().toLowerCase()]
      );
      console.log('Without active filter:', noActiveFilter.rows);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

debugRecoveryLookup();
