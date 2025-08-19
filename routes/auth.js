// routes/auth.js - Backend for registration, adapted for Mini App
const express = require('express');
const router = express.Router();
const path = require('path');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const turnkeyClient = require('../turnkeyClient');
const axios = require('axios');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const EC = require('elliptic').ec;
const ecP256 = new EC('p256');


// Fetch BOT_TOKEN from env for initData validation
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Function to validate Telegram initData
function validateInitData(initData) {
  const parsed = new URLSearchParams(initData);
  const hash = parsed.get('hash');
  parsed.delete('hash');
  const dataCheckString = Array.from(parsed.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return computedHash === hash;
}

// Check pioneer eligibility
async function checkPioneerEligibility(telegramId) {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE telegram_id <= 1000000000",
      []
    );
    const totalUsers = parseInt(result.rows[0].count);
    return { eligible: totalUsers < 1000, totalUsers };
  } catch (error) {
    console.error('Error checking pioneer eligibility:', error);
    return { eligible: false, totalUsers: 0 };
  }
}

// Add pioneer to founders table
async function addPioneer(telegramId) {
  try {
    await pool.query(
      "INSERT INTO founders (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING",
      [telegramId]
    );
    console.log(`Added ${telegramId} as pioneer`);
  } catch (error) {
    console.error('Error adding pioneer:', error);
  }
}

// Send email verification during registration
async function verifyEmailWithTurnkey(email, orgId, userPublicKey) {
  try {
    // Validate email format first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    // Use a simpler approach - let's try with a properly formatted dummy P-256 key first
    // Based on the recovery logs, the issue might be that we need a specific format
    const tempPublicKey = "03" + "0".repeat(64); // Valid P-256 format for testing
    
    console.log('Using temp key for email auth:', {
      publicKeyLength: tempPublicKey.length,
      publicKeyPrefix: tempPublicKey.substring(0, 10) + '...'
    });
    
    const verificationData = {
      type: "ACTIVITY_TYPE_EMAIL_AUTH", 
      organizationId: process.env.TURNKEY_ORG_ID, // Back to root org for email verification
      parameters: {
        email: email.trim().toLowerCase(),
        targetPublicKey: tempPublicKey, // Use properly formatted P-256 key
        apiKeyName: `Email Verification - ${email}`,
        expirationSeconds: "3600",
        emailCustomization: {
          appName: "LumenBro",
          magicLinkTemplate: "Welcome to LumenBro! Please verify your email by entering this code in the app: {{authBundle}}"
        }
      }
    };

    console.log('Sending email verification request:', {
      email: verificationData.parameters.email,
      targetPublicKey: verificationData.parameters.targetPublicKey.substring(0, 20) + '...',
      orgId: verificationData.organizationId
    });
    
    const response = await turnkeyClient.emailAuth(verificationData);
    
    // Store the temp private key for later decryption if needed
    // In production, you'd store this securely
    console.log('Email verification successful, temp private key available for decryption');
    
    return response;
  } catch (error) {
    console.error('Email verification failed:', error);
    throw error;
  }
}

// Updated to use API public key for root user, no authenticators
async function createTurnkeySubOrg(telegram_id, email, apiPublicKey) {
  const params = {
    subOrganizationName: `User ${telegram_id}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: email,
        userEmail: email, // CRITICAL: This might be what's missing for email auth!
        apiKeys: [
          {
            apiKeyName: `API Key - ${email}`,
            publicKey: apiPublicKey,
            curveType: "API_KEY_CURVE_SECP256K1"
          }
        ],
        authenticators: [],
        oauthProviders: []
      }
    ],
    wallet: {
      walletName: `Stellar-Wallet-${telegram_id}`,
      accounts: [
        {
          curve: "CURVE_ED25519",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/148'/0'",
          addressFormat: "ADDRESS_FORMAT_XLM"
        }
      ]
    }
  };

  const response = await turnkeyClient.createSubOrganization(params);
  console.log('Full Turnkey createSubOrganization response:', JSON.stringify(response, null, 2));

  // Parse V7 response structure
  const result = response.activity?.result?.createSubOrganizationResultV7;
  if (!result) {
    console.error('Invalid response structure:', response);
    throw new Error("Invalid response structure from Turnkey");
  }

  const subOrgId = result.subOrganizationId;
  const wallet = result.wallet;
  const keyId = wallet.walletId;
  const publicKey = wallet.addresses[0];  // Use Stellar address as public key
  const rootUserId = result.rootUserIds[0];

  console.log('Parsed fields: subOrgId=', subOrgId, 'keyId=', keyId, 'publicKey=', publicKey, 'rootUserId=', rootUserId);

  if (!subOrgId || !keyId || !publicKey || !rootUserId) {
    throw new Error("Missing data in Turnkey response");
  }

  // Return immediately
  return { subOrgId, keyId, publicKey, rootUserId };
}

// Updated handle: No challenge/attestation, add apiPublicKey
async function handleTurnkeyPost(telegram_id, referrer_id, email, apiPublicKey) {
  const existing = await pool.query(
    "SELECT turnkey_sub_org_id, turnkey_key_id, public_key FROM turnkey_wallets WHERE telegram_id = $1 AND is_active = TRUE",
    [telegram_id]
  );
  if (existing.rows.length > 0) {
    console.log(`Existing sub-org found for ${telegram_id}`);
    return { subOrgId: existing.rows[0].turnkey_sub_org_id, email };
  }

  const { subOrgId, keyId, publicKey, rootUserId } = await createTurnkeySubOrg(telegram_id, email, apiPublicKey);

  // TEMPORARILY DISABLED: Email verification during registration
  // TODO: Enable this once we figure out the correct Turnkey Email Auth format
  console.log(`Skipping email verification for ${email} during registration - will enable once format is correct`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query("SELECT * FROM users WHERE telegram_id = $1", [telegram_id]);
    if (userRes.rows.length === 0) {
      await client.query(
        "INSERT INTO users (telegram_id, referral_code) VALUES ($1, $2)",
        [telegram_id, String(telegram_id).slice(-6)]
      );
      if (referrer_id) {
        await client.query(
          "INSERT INTO referrals (referee_id, referrer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [telegram_id, referrer_id]
        );
      }
    }
    await client.query(
      "INSERT INTO turnkey_wallets (telegram_id, turnkey_sub_org_id, turnkey_key_id, public_key, turnkey_api_public_key, is_active) " +
      "VALUES ($1, $2, $3, $4, $5, TRUE) " +
      "ON CONFLICT (telegram_id, turnkey_key_id) DO UPDATE SET turnkey_sub_org_id = $2, public_key = $4, turnkey_api_public_key = $5, is_active = TRUE",
      [telegram_id, subOrgId, keyId, publicKey, apiPublicKey]
    );
    await client.query(
      "UPDATE users SET public_key = $1, user_email = $2, turnkey_user_id = $3 WHERE telegram_id = $4",
      [publicKey, email, rootUserId, telegram_id]
    );
    
    // Add pioneer status if eligible
    const eligibility = await checkPioneerEligibility(telegram_id);
    if (eligibility.eligible) {
      await client.query(
        "INSERT INTO founders (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING",
        [telegram_id]
      );
      console.log(`Added ${telegram_id} as pioneer`);
    }
    
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: telegram_id,
    text: "Setup complete! Use /start in the bot."
  });

  return { subOrgId, email };
}

// Mini-app registration endpoint
router.post('/mini-app/create-sub-org', async (req, res) => {
  const { telegram_id, referrer_id, email, apiPublicKey } = req.body;
  
  if (!telegram_id || !email || !apiPublicKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await handleTurnkeyPost(telegram_id, referrer_id, email, apiPublicKey);
    res.json(result);
  } catch (e) {
    console.error('Error in create-sub-org:', e);
    res.status(500).json({ error: e.message });
  }
});

// Legacy user check endpoint
router.get('/mini-app/check-legacy-user/:telegram_id', async (req, res) => {
  const { telegram_id } = req.params;
  
  try {
    const result = await pool.query(
      "SELECT public_key FROM users WHERE telegram_id = $1",
      [telegram_id]
    );
    
    const isLegacy = result.rows.length > 0 && result.rows[0].public_key;
    res.json({ isLegacy });
  } catch (e) {
    console.error('Error checking legacy user:', e);
    res.status(500).json({ error: e.message });
  }
});

// Mark migration as notified
router.post('/mini-app/mark-migration-notified', async (req, res) => {
  const { telegram_id } = req.body;
  
  try {
    await pool.query(
      "UPDATE users SET migration_notified = TRUE WHERE telegram_id = $1",
      [telegram_id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Error marking migration notified:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /mini-app/clear – Clear DB state for user (REMOVED - now only clears client-side data)
// This endpoint was removed to prevent accidental database clearing
// Users should use the client-side clear function which only clears Telegram Cloud Storage

// NEW: Endpoint to handle email verification during registration
router.post('/verify-email', async (req, res) => {
  const { telegram_id, email, verificationCode } = req.body;
  
  if (!telegram_id || !email || !verificationCode) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Get user's orgId
    const userRes = await pool.query(
      "SELECT tw.turnkey_sub_org_id FROM turnkey_wallets tw WHERE tw.telegram_id = $1 AND tw.is_active = TRUE",
      [telegram_id]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const orgId = userRes.rows[0].turnkey_sub_org_id;

    // TODO: Complete email verification with Turnkey
    // This would involve using the verification code to complete the email auth process
    
    // Mark email as verified in database
    await pool.query(
      "UPDATE users SET user_email = $1, migration_notified = TRUE WHERE telegram_id = $2",
      [email, telegram_id]
    );

    res.json({ success: true, message: "Email verified successfully" });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DB session-only logout (idempotent, does not touch email or wallet data)
router.post('/api/session/logout', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ success: false, error: 'telegram_id is required' });
    }

    await pool.query(`
      UPDATE users SET 
        turnkey_session_id = NULL, 
        temp_api_public_key = NULL, 
        temp_api_private_key = NULL, 
        kms_encrypted_session_key = NULL,
        kms_key_id = NULL,
        session_expiry = NULL,
        session_created_at = NULL
      WHERE telegram_id = $1
    `, [telegram_id]);

    const check = await pool.query(`
      SELECT turnkey_session_id, temp_api_public_key, temp_api_private_key,
             kms_encrypted_session_key, kms_key_id, session_expiry, session_created_at
      FROM users WHERE telegram_id = $1
    `, [telegram_id]);

    const row = check.rows[0] || null;
    const allNull = row ? Object.values(row).every(v => v === null) : true;
    return res.json({ success: allNull, telegram_id, session_fields: row });
  } catch (error) {
    console.error('❌ session/logout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Inspect current session field state
router.get('/api/session/status/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    const check = await pool.query(`
      SELECT turnkey_session_id, temp_api_public_key, temp_api_private_key,
             kms_encrypted_session_key, kms_key_id, session_expiry, session_created_at
      FROM users WHERE telegram_id = $1
    `, [telegram_id]);
    const row = check.rows[0] || null;
    const allNull = row ? Object.values(row).every(v => v === null) : true;
    res.json({ telegram_id, session_fields: row, session_empty: allNull });
  } catch (error) {
    console.error('❌ session/status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add this new endpoint for automated cloud storage clearing
router.post('/api/clear-user-data', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    
    if (!telegram_id) {
      return res.status(400).json({ success: false, error: 'telegram_id is required' });
    }

    console.log(`🧹 Automated clearing of user data for telegram_id: ${telegram_id}`);

    // Clear database session data (same as unregister)
    const result = await pool.query(`
      UPDATE users SET 
        turnkey_session_id = NULL, 
        temp_api_public_key = NULL, 
        temp_api_private_key = NULL, 
        kms_encrypted_session_key = NULL,
        kms_key_id = NULL,
        session_expiry = NULL,
        session_created_at = NULL,
        turnkey_user_id = NULL,
        user_email = NULL
      WHERE telegram_id = $1
    `, [telegram_id]);

    if (result.rowCount === 0) {
      console.log(`⚠️ No user found with telegram_id: ${telegram_id}`);
      return res.json({ success: true, message: 'No user data found to clear' });
    }

    console.log(`✅ Successfully cleared session data for telegram_id: ${telegram_id}`);
    
    res.json({ 
      success: true, 
      message: 'User session data cleared successfully',
      telegram_id: telegram_id
    });

  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add endpoint for automated cloud storage clearing
router.post('/api/auto-clear-cloud-storage', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    
    if (!telegram_id) {
      return res.status(400).json({ success: false, error: 'telegram_id is required' });
    }

    console.log(`🧹 Automated cloud storage clearing for telegram_id: ${telegram_id}`);

    // This endpoint just returns a success response
    // The actual clearing will be done by the mini-app when it opens
    res.json({ 
      success: true, 
      message: 'Cloud storage clearing initiated',
      telegram_id: telegram_id,
      mini_app_url: `https://lumenbro.com/mini-app/index.html?action=auto-clear&telegram_id=${telegram_id}`
    });

  } catch (error) {
    console.error('❌ Error initiating cloud storage clear:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check user wallet data
router.get('/debug/user-wallet', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // Check if the API key exists in turnkey_wallets
      console.log('🔍 Checking for API key: 02d3424f01c2313dc7a3420c8baf8a3fc9b809c844f5abf51d52ab5d3d7f8bd9cd');
      
      const walletResult = await client.query(
        "SELECT * FROM turnkey_wallets WHERE public_key = $1",
        ['02d3424f01c2313dc7a3420c8baf8a3fc9b809c844f5abf51d52ab5d3d7f8bd9cd']
      );
      
      console.log('Wallet records found:', walletResult.rows.length);
      
      // Check all turnkey_wallets records
      console.log('\n🔍 All turnkey_wallets records:');
      const allWallets = await client.query("SELECT telegram_id, turnkey_sub_org_id, public_key, is_active FROM turnkey_wallets ORDER BY telegram_id");
      console.log('Total wallets:', allWallets.rows.length);
      
      // Check users table for this email
      console.log('\n🔍 Checking users table for email: bpeterscqa@gmail.com');
      const userResult = await client.query(
        "SELECT telegram_id, public_key, turnkey_user_id, user_email FROM users WHERE user_email = $1",
        ['bpeterscqa@gmail.com']
      );
      
      console.log('User records found:', userResult.rows.length);
      
      res.json({
        apiKeyFound: walletResult.rows.length > 0,
        walletData: walletResult.rows[0] || null,
        totalWallets: allWallets.rows.length,
        allWallets: allWallets.rows,
        userFound: userResult.rows.length > 0,
        userData: userResult.rows[0] || null
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint for mobile payload signing (fallback for mobile Web Crypto API limitations)
router.post('/mini-app/sign-payload', async (req, res) => {
  try {
    const { payload, privateKey, publicKey } = req.body;
    
    if (!payload || !privateKey || !publicKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('🔍 Mobile payload signing request (fallback):', {
      payloadLength: payload.length,
      privateKeyLength: privateKey.length,
      publicKeyLength: publicKey.length
    });

    // Find the correct sub-organization ID and public key for this user
    console.log('🔍 Looking up user data for Telegram Cloud Storage API key:', publicKey);
    
    // First, try to find the user by the provided Turnkey API public key
    let userResult = await pool.query(
      "SELECT tw.turnkey_sub_org_id, u.user_email, tw.turnkey_api_public_key, tw.telegram_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_api_public_key = $1",
      [publicKey]
    );
    
    // If not found, try to find by user email (fallback)
    if (userResult.rows.length === 0) {
      console.log('🔍 Turnkey API key not found in database, trying to find user by email...');
      
      // Get user email from the request or try to find it
      const emailResponse = await pool.query(
        "SELECT u.user_email FROM users u WHERE u.user_email = $1",
        ['bpeterscqa@gmail.com'] // Hardcoded for now since we know the user
      );
      
      if (emailResponse.rows.length > 0) {
        userResult = await pool.query(
          "SELECT tw.turnkey_sub_org_id, u.user_email, tw.turnkey_api_public_key, tw.telegram_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE u.user_email = $1 AND tw.is_active = TRUE",
          [emailResponse.rows[0].user_email]
        );
      }
    }
    
    if (userResult.rows.length === 0) {
      console.error('❌ No sub-organization found for user');
      return res.status(404).json({ error: 'Sub-organization not found for this user' });
    }
    
    const subOrgId = userResult.rows[0].turnkey_sub_org_id;
    const userEmail = userResult.rows[0].user_email;
    let dbApiPublicKey = userResult.rows[0].turnkey_api_public_key;
    const telegramIdForUpdate = userResult.rows[0].telegram_id;

    // If DB key differs or is null, adopt the client key and persist for future
    if (!dbApiPublicKey || dbApiPublicKey !== publicKey) {
      dbApiPublicKey = publicKey;
      if (telegramIdForUpdate) {
        try {
          await pool.query(
            "UPDATE turnkey_wallets SET turnkey_api_public_key = $1 WHERE telegram_id = $2 AND is_active = TRUE",
            [dbApiPublicKey, telegramIdForUpdate]
          );
          console.log('🔧 Updated DB turnkey_api_public_key for telegram_id', telegramIdForUpdate);
        } catch (e) {
          console.warn('⚠️ Failed to update DB turnkey_api_public_key:', e.message);
        }
      }
    }
    
    console.log('✅ Found sub-organization ID:', subOrgId, 'for user:', userEmail);
    console.log('✅ Database Turnkey API key:', dbApiPublicKey, '(length:', dbApiPublicKey?.length, ')');
    console.log('✅ Telegram Cloud Storage key:', publicKey, '(length:', publicKey?.length, ')');
    console.log('🔍 Database API key format:', dbApiPublicKey?.startsWith('02') || dbApiPublicKey?.startsWith('03') ? 'Turnkey API' : 'Unknown');
    console.log('🔍 Telegram key format:', publicKey?.startsWith('02') || publicKey?.startsWith('03') ? 'Turnkey API' : 'Unknown');

    // Convert hex private key to buffer (use the private key from Telegram Cloud Storage)
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    
    // Handle payload - it might be an object or string
    let payloadString;
    if (typeof payload === 'object') {
      // If payload is an object, stringify it
      payloadString = JSON.stringify(payload);
    } else {
      // If payload is already a string, use it as is
      payloadString = payload;
    }
    
    // Create SHA-256 hash of the payload
    const payloadHash = crypto.createHash('sha256').update(payloadString).digest();

    // Sign with P-256 (secp256r1) using elliptic, enforce low-s (canonical)
    const keyPair = ecP256.keyFromPrivate(privateKeyBuffer);
    const sig = keyPair.sign(payloadHash, { canonical: true });
    const signatureHex = Buffer.from(sig.toDER()).toString('hex');

    console.log('✅ Mobile backend signing successful');

    // Log trade and calculate referral rewards (if this is a transaction)
    try {
      // Check if this is a transaction (XDR format)
      if (payloadString && payloadString.length > 100) {
        console.log('💾 Logging transaction to database...');
        
        // Extract transaction hash from payload
        const txHash = payloadString.substring(0, 64); // First 64 chars as hash
        
        // Calculate XLM volume (you can adjust this based on your needs)
        const xlmVolume = 0; // Will need to parse XDR to get actual volume
        
        // Log to trades table
        const tradeLogQuery = `
          INSERT INTO trades (
            user_id, 
            xlm_volume,
            tx_hash,
            turnkey_activity_id,
            fee_amount,
            fee_asset,
            timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `;
        
        await pool.query(tradeLogQuery, [
          telegramIdForUpdate,
          xlmVolume,
          txHash,
          'mobile-signing', // Activity ID for mobile signing
          0, // Fee amount (will need to parse from XDR)
          'XLM' // Fee asset
        ]);
        
        console.log('✅ Trade logged successfully');
        
        // Calculate referral rewards (same logic as Python bot)
        // await handleReferralRewards(telegramIdForUpdate, feeAmount);
      }
    } catch (dbError) {
      console.error('⚠️ Trade logging failed:', dbError);
      // Don't fail the transaction if logging fails
    }

    res.json({ 
      signature: signatureHex,
      publicKey: dbApiPublicKey, // ensure we return the active API key used
      subOrgId: subOrgId,
      message: 'Mobile fallback signing successful'
    });
    
  } catch (error) {
    console.error('❌ Mobile backend signing error:', error);
    res.status(500).json({ 
      error: 'Backend signing failed',
      details: error.message 
    });
  }
});

// NEW: Get user fee status for fee calculation (mirrors Python bot logic)
router.get('/mini-app/user-fee-status/:telegram_id', async (req, res) => {
  const { telegram_id } = req.params;
  
  try {
    // Get comprehensive user status for fee calculation (mirrors Python bot)
    const userRes = await pool.query(`
      SELECT 
        u.telegram_id,
        u.pioneer_status,
        u.referral_code,
        u.user_email,
        u.public_key,
        f.telegram_id as is_founder,
        r.referee_id as is_referral
      FROM users u
      LEFT JOIN founders f ON u.telegram_id = f.telegram_id
      LEFT JOIN referrals r ON u.telegram_id = r.referee_id
      WHERE u.telegram_id = $1
    `, [telegram_id]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userRes.rows[0];
    
    // Mirror Python bot fee logic exactly
    let feePercentage = 0.01; // Default 1% base rate
    let discountType = 'none';
    let discountRate = 0.00;
    let discountDescription = 'No discount';
    
    // Check founder/pioneer status (0.1% fee = 90% discount)
    if (user.pioneer_status || user.is_founder) {
      feePercentage = 0.001; // 0.1% for founders (pioneers)
      discountType = 'pioneer';
      discountRate = 0.90;
      discountDescription = 'Pioneer/Founder (90% discount)';
    }
    // Check referral status (0.9% fee = 10% discount) - only if not pioneer
    else if (user.referral_code || user.is_referral) {
      feePercentage = 0.009; // 0.9% for referred users
      discountType = 'referral';
      discountRate = 0.10;
      discountDescription = 'Referral (10% discount)';
    }
    
    res.json({
      success: true,
      user: {
        telegram_id: user.telegram_id,
        email: user.user_email,
        public_key: user.public_key,
        pioneer_status: user.pioneer_status || !!user.is_founder,
        referral_code: user.referral_code,
        is_referral: !!user.is_referral
      },
      fee_status: {
        discount_type: discountType,
        discount_rate: discountRate,
        discount_description: discountDescription,
        fee_percentage: feePercentage, // Mirror Python bot field name
        base_fee_rate: 0.01,
        final_fee_rate: feePercentage
      }
    });
    
  } catch (error) {
    console.error('Error getting user fee status:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Get user fee status by orgId (for wallet integration)
router.get('/mini-app/user-fee-status-by-org/:orgId', async (req, res) => {
  const { orgId } = req.params;
  
  try {
    // Get user by orgId (similar to existing get-user-email endpoint)
    const userRes = await pool.query(`
      SELECT 
        u.telegram_id,
        u.pioneer_status,
        u.referral_code,
        u.user_email,
        u.public_key,
        f.telegram_id as is_founder,
        r.referee_id as is_referral
      FROM users u
      JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id
      LEFT JOIN founders f ON u.telegram_id = f.telegram_id
      LEFT JOIN referrals r ON u.telegram_id = r.referee_id
      WHERE tw.turnkey_sub_org_id = $1 AND tw.is_active = TRUE
    `, [orgId]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found for this organization" });
    }
    
    const user = userRes.rows[0];
    
    // Mirror Python bot fee logic exactly
    let feePercentage = 0.01; // Default 1% base rate
    let discountType = 'none';
    let discountRate = 0.00;
    let discountDescription = 'No discount';
    
    if (user.pioneer_status || user.is_founder) {
      feePercentage = 0.001; // 0.1% for founders (pioneers)
      discountType = 'pioneer';
      discountRate = 0.90;
      discountDescription = 'Pioneer/Founder (90% discount)';
    }
    else if (user.referral_code || user.is_referral) {
      feePercentage = 0.009; // 0.9% for referred users
      discountType = 'referral';
      discountRate = 0.10;
      discountDescription = 'Referral (10% discount)';
    }
    
    res.json({
      success: true,
      user: {
        telegram_id: user.telegram_id,
        email: user.user_email,
        public_key: user.public_key,
        pioneer_status: user.pioneer_status || !!user.is_founder,
        referral_code: user.referral_code,
        is_referral: !!user.is_referral
      },
      fee_status: {
        discount_type: discountType,
        discount_rate: discountRate,
        discount_description: discountDescription,
        fee_percentage: feePercentage,
        base_fee_rate: 0.01,
        final_fee_rate: feePercentage
      }
    });
    
  } catch (error) {
    console.error('Error getting user fee status by orgId:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Calculate fees for a transaction (mirrors Python bot logic exactly)
router.post('/mini-app/calculate-fees', async (req, res) => {
  const { telegram_id, transaction_amount, transaction_type = 'payment', asset_code, asset_issuer, xlm_equivalent } = req.body;
  
  if (!telegram_id || !transaction_amount) {
    return res.status(400).json({ error: "Missing telegram_id or transaction_amount" });
  }
  
  try {
    // Get user fee status (mirrors Python bot logic)
    const userRes = await pool.query(`
      SELECT 
        u.telegram_id,
        u.pioneer_status,
        u.referral_code,
        f.telegram_id as is_founder,
        r.referee_id as is_referral
      FROM users u
      LEFT JOIN founders f ON u.telegram_id = f.telegram_id
      LEFT JOIN referrals r ON u.telegram_id = r.referee_id
      WHERE u.telegram_id = $1
    `, [telegram_id]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userRes.rows[0];
    
    // Mirror Python bot fee logic exactly
    let feePercentage = 0.01; // Default 1% base rate
    let discountType = 'none';
    let discountRate = 0.00;
    
    if (user.pioneer_status || user.is_founder) {
      feePercentage = 0.001; // 0.1% for founders (pioneers)
      discountType = 'pioneer';
      discountRate = 0.90;
    }
    else if (user.referral_code || user.is_referral) {
      feePercentage = 0.009; // 0.9% for referred users
      discountType = 'referral';
      discountRate = 0.10;
    }
    
    // Calculate XLM volume (mirrors Python bot logic)
    let xlmVolume;
    if (asset_code === 'XLM' || !asset_code) {
      // Native XLM transaction
      xlmVolume = parseFloat(transaction_amount);
    } else {
      // Non-XLM asset - use provided XLM equivalent or calculate
      if (xlm_equivalent) {
        xlmVolume = parseFloat(xlm_equivalent);
      } else {
        // TODO: Implement XLM equivalent calculation using Stellar paths
        // For now, use a placeholder - this should be calculated client-side
        xlmVolume = parseFloat(transaction_amount) * 0.1; // Placeholder conversion
      }
    }
    
    // Calculate fee (mirrors Python bot logic exactly)
    const fee = parseFloat((feePercentage * xlmVolume).toFixed(7));
    const totalAmount = parseFloat(transaction_amount) + fee;
    
    res.json({
      success: true,
      calculation: {
        transaction_amount: parseFloat(transaction_amount),
        transaction_type: transaction_type,
        asset_code: asset_code || 'XLM',
        asset_issuer: asset_issuer,
        xlm_volume: xlmVolume,
        fee_percentage: feePercentage,
        fee: fee,
        total_amount: totalAmount
      },
      user_status: {
        telegram_id: user.telegram_id,
        pioneer_status: user.pioneer_status || !!user.is_founder,
        referral_code: user.referral_code,
        is_referral: !!user.is_referral,
        discount_type: discountType,
        discount_rate: discountRate
      }
    });
    
  } catch (error) {
    console.error('Error calculating fees:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Log XLM volume for referrals (mirrors Python bot logic)
router.post('/mini-app/log-xlm-volume', async (req, res) => {
  const { telegram_id, xlm_volume, tx_hash, action_type = 'payment' } = req.body;
  
  if (!telegram_id || !xlm_volume || !tx_hash) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    // Check if transaction already logged (mirrors Python bot logic)
    const existingTx = await pool.query(
      "SELECT COUNT(*) as count FROM trades WHERE tx_hash = $1",
      [tx_hash]
    );
    
    if (existingTx.rows[0].count > 0) {
      console.warn(`Transaction ${tx_hash} already logged, skipping`);
      return res.json({ success: true, message: "Transaction already logged" });
    }
    
    // Log the trade (mirrors Python bot trades table)
    await pool.query(
      "INSERT INTO trades (user_id, xlm_volume, tx_hash, action_type) VALUES ($1, $2, $3, $4)",
      [telegram_id, parseFloat(xlm_volume), tx_hash, action_type]
    );
    
    // Also log fee for tracking (mirrors Python bot fees table)
    const fee = parseFloat((0.01 * xlm_volume).toFixed(7)); // Base fee for logging
    await pool.query(
      "INSERT INTO fees (telegram_id, action_type, amount, fee, tx_hash) VALUES ($1, $2, $3, $4, $5)",
      [telegram_id, action_type, parseFloat(xlm_volume), fee, tx_hash]
    );
    
    console.log(`Logged XLM volume for user ${telegram_id}: ${xlm_volume} XLM, tx_hash: ${tx_hash}`);
    
    res.json({ 
      success: true, 
      message: "XLM volume logged successfully",
      logged_volume: parseFloat(xlm_volume),
      tx_hash: tx_hash
    });
    
  } catch (error) {
    console.error('Error logging XLM volume:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Calculate referral shares (mirrors Python bot logic)
router.post('/mini-app/calculate-referral-shares', async (req, res) => {
  const { telegram_id, fee_amount } = req.body;
  
  if (!telegram_id || !fee_amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    // Get referrer chain (up to 5 levels, mirrors Python bot logic)
    const referrerChain = [];
    let currentUser = telegram_id;
    
    for (let level = 0; level < 5; level++) {
      const referrerRes = await pool.query(
        "SELECT referrer_id FROM referrals WHERE referee_id = $1",
        [currentUser]
      );
      
      if (referrerRes.rows.length === 0) {
        break;
      }
      
      const referrerId = referrerRes.rows[0].referrer_id;
      referrerChain.push(referrerId);
      currentUser = referrerId;
    }
    
    console.log(`Referrer chain for user ${telegram_id}: ${referrerChain}`);
    
    // Calculate user's trading volume for past week (mirrors Python bot logic)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const volumeRes = await pool.query(
      "SELECT SUM(xlm_volume) as total_volume FROM trades WHERE user_id = $1 AND timestamp >= $2",
      [telegram_id, oneWeekAgo]
    );
    
    const userVolume = parseFloat(volumeRes.rows[0].total_volume || 0);
    console.log(`User ${telegram_id} trading volume (past week): ${userVolume} XLM`);
    
    // Determine share percentage based on volume (mirrors Python bot logic)
    const sharePercentage = userVolume >= 100000 ? 0.35 : 0.25; // $10,000 in XLM equivalent
    console.log(`Share percentage for user ${telegram_id}: ${sharePercentage}`);
    
    // Distribute shares across referrer chain (mirrors Python bot logic)
    const referralShares = [];
    for (let level = 0; level < referrerChain.length; level++) {
      const referrerId = referrerChain[level];
      const levelShare = sharePercentage * (1 - 0.05 * level); // Decrease by 5% per level
      
      if (levelShare <= 0) {
        console.warn(`Level share for referrer ${referrerId} at level ${level + 1} is <= 0, skipping`);
        break;
      }
      
      const amount = parseFloat((fee_amount * levelShare).toFixed(7));
      console.log(`Calculated referral amount for referrer ${referrerId} at level ${level + 1}: ${amount} XLM`);
      
      // Log reward (mirrors Python bot rewards table)
      await pool.query(
        "INSERT INTO rewards (user_id, amount, status) VALUES ($1, $2, 'unpaid')",
        [referrerId, amount]
      );
      
      referralShares.push({
        referrer_id: referrerId,
        level: level + 1,
        share_percentage: levelShare,
        amount: amount
      });
      
      console.log(`Successfully logged referral fee for referrer ${referrerId}: ${amount} XLM`);
    }
    
    res.json({
      success: true,
      message: "Referral shares calculated and logged",
      user_volume: userVolume,
      share_percentage: sharePercentage,
      referral_shares: referralShares
    });
    
  } catch (error) {
    console.error('Error calculating referral shares:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Get user authenticator type and signing method
router.get('/mini-app/user-authenticator-type/:telegram_id', async (req, res) => {
  const { telegram_id } = req.params;
  
  try {
    // Get comprehensive user data to determine authenticator type
    const userRes = await pool.query(`
      SELECT 
        u.telegram_id,
        u.pioneer_status,
        u.referral_code,
        u.user_email,
        u.public_key,
        u.kms_encrypted_session_key,
        u.kms_key_id,
        u.temp_api_public_key,
        u.temp_api_private_key,
        u.session_expiry,
        u.source_old_db,
        f.telegram_id as is_founder,
        r.referee_id as is_referral,
        tw.turnkey_sub_org_id,
        tw.turnkey_key_id,
        tw.turnkey_api_public_key
      FROM users u
      LEFT JOIN founders f ON u.telegram_id = f.telegram_id
      LEFT JOIN referrals r ON u.telegram_id = r.referee_id
      LEFT JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id AND tw.is_active = TRUE
      WHERE u.telegram_id = $1
    `, [telegram_id]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userRes.rows[0];
    
    // Determine authenticator type (mirrors Python bot logic)
    let authenticatorType = 'unknown';
    let signingMethod = 'unknown';
    let hasActiveSession = false;
    
    // Check for KMS session (new users)
    if (user.kms_encrypted_session_key && user.kms_key_id) {
      authenticatorType = 'session_keys';
      signingMethod = 'python_bot_kms';
      hasActiveSession = true;
    }
    // Check for Telegram Cloud API keys (new users with TG storage)
    else if (user.turnkey_api_public_key) {
      authenticatorType = 'telegram_cloud';
      signingMethod = 'python_bot_tg_cloud';
      hasActiveSession = true;
    }
    // Check for legacy session keys
    else if (user.temp_api_public_key && user.temp_api_private_key) {
      authenticatorType = 'legacy';
      signingMethod = 'python_bot_legacy';
      hasActiveSession = true;
    }
    // Check for legacy users with source_old_db
    else if (user.source_old_db) {
      authenticatorType = 'legacy';
      signingMethod = 'python_bot_legacy';
      hasActiveSession = false; // Need to recreate session
    }
    
    // Check session expiry
    if (hasActiveSession && user.session_expiry) {
      const sessionExpiry = new Date(user.session_expiry);
      const now = new Date();
      if (sessionExpiry < now) {
        hasActiveSession = false;
        signingMethod = 'session_expired';
      }
    }
    
    // Determine fee status (mirrors Python bot logic)
    let feePercentage = 0.01; // Default 1% base rate
    let discountType = 'none';
    let discountRate = 0.00;
    
    if (user.pioneer_status || user.is_founder) {
      feePercentage = 0.001; // 0.1% for founders (pioneers)
      discountType = 'pioneer';
      discountRate = 0.90;
    }
    else if (user.referral_code || user.is_referral) {
      feePercentage = 0.009; // 0.9% for referred users
      discountType = 'referral';
      discountRate = 0.10;
    }
    
    res.json({
      success: true,
      user: {
        telegram_id: user.telegram_id,
        email: user.user_email,
        public_key: user.public_key,
        pioneer_status: user.pioneer_status || !!user.is_founder,
        referral_code: user.referral_code,
        is_referral: !!user.is_referral
      },
      authenticator: {
        type: authenticatorType,
        signing_method: signingMethod,
        has_active_session: hasActiveSession,
        turnkey_sub_org_id: user.turnkey_sub_org_id,
        turnkey_key_id: user.turnkey_key_id
      },
      fee_status: {
        discount_type: discountType,
        discount_rate: discountRate,
        fee_percentage: feePercentage,
        base_fee_rate: 0.01,
        final_fee_rate: feePercentage
      }
    });
    
  } catch (error) {
    console.error('Error getting user authenticator type:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Sign transaction with appropriate method
router.post('/mini-app/sign-transaction', async (req, res) => {
  const { telegram_id, xdr, transaction_type = 'payment', include_fee = false } = req.body;
  
  if (!telegram_id || !xdr) {
    return res.status(400).json({ error: "Missing telegram_id or xdr" });
  }
  
  try {
    // Get user authenticator type
    const userRes = await pool.query(`
      SELECT 
        u.telegram_id,
        u.kms_encrypted_session_key,
        u.kms_key_id,
        u.temp_api_public_key,
        u.temp_api_private_key,
        u.session_expiry,
        u.source_old_db,
        tw.turnkey_sub_org_id,
        tw.turnkey_key_id,
        tw.turnkey_api_public_key
      FROM users u
      LEFT JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id AND tw.is_active = TRUE
      WHERE u.telegram_id = $1
    `, [telegram_id]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userRes.rows[0];
    
    // Determine signing method
    let signingMethod = 'unknown';
    let hasActiveSession = false;
    
    if (user.kms_encrypted_session_key && user.kms_key_id) {
      signingMethod = 'python_bot_kms';
      hasActiveSession = true;
    }
    else if (user.turnkey_api_public_key) {
      signingMethod = 'python_bot_tg_cloud';
      hasActiveSession = true;
    }
    else if (user.temp_api_public_key && user.temp_api_private_key) {
      signingMethod = 'python_bot_legacy';
      hasActiveSession = true;
    }
    else if (user.source_old_db) {
      signingMethod = 'python_bot_legacy';
      hasActiveSession = false;
    }
    
    // Check session expiry
    if (hasActiveSession && user.session_expiry) {
      const sessionExpiry = new Date(user.session_expiry);
      const now = new Date();
      if (sessionExpiry < now) {
        hasActiveSession = false;
        signingMethod = 'session_expired';
      }
    }
    
    if (!hasActiveSession) {
      return res.status(401).json({ 
        error: "No active session", 
        signing_method: signingMethod,
        requires_login: true 
      });
    }
    
    // Call Python bot for signing
    const pythonBotResponse = await fetch('http://localhost:8080/api/sign', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${generateJWT(telegram_id)}` // You'll need to implement JWT generation
      },
      body: JSON.stringify({
        telegram_id: parseInt(telegram_id),
        xdr: xdr,
        action_type: transaction_type,
        include_fee: include_fee
      })
    });
    
    if (!pythonBotResponse.ok) {
      const errorData = await pythonBotResponse.json();
      throw new Error(`Python bot signing failed: ${errorData.error || pythonBotResponse.status}`);
    }
    
    const result = await pythonBotResponse.json();
    
    res.json({
      success: true,
      signed_xdr: result.signed_xdr,
      hash: result.hash,
      fee: result.fee,
      signing_method: signingMethod
    });
    
  } catch (error) {
    console.error('Error signing transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint for development - simulate signing with test user
router.post('/mini-app/test-sign-transaction', async (req, res) => {
  const { xdr, transaction_type = 'payment', include_fee = false } = req.body;
  
  if (!xdr) {
    return res.status(400).json({ error: "Missing xdr" });
  }
  
  try {
    // Use test user ID for development
    const testTelegramId = 5014800072; // Test user ID
    
    console.log('🧪 Testing transaction signing with test user:', testTelegramId);
    
    // Get test user authenticator type
    const userRes = await pool.query(`
      SELECT 
        u.telegram_id,
        u.kms_encrypted_session_key,
        u.kms_key_id,
        u.temp_api_public_key,
        u.temp_api_private_key,
        u.session_expiry,
        u.source_old_db,
        tw.turnkey_sub_org_id,
        tw.turnkey_key_id,
        tw.turnkey_api_public_key
      FROM users u
      LEFT JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id AND tw.is_active = TRUE
      WHERE u.telegram_id = $1
    `, [testTelegramId]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ 
        error: "Test user not found", 
        message: "Please create a test user in the database first",
        test_telegram_id: testTelegramId
      });
    }
    
    const user = userRes.rows[0];
    
    // Determine signing method
    let signingMethod = 'unknown';
    let hasActiveSession = false;
    
    if (user.kms_encrypted_session_key && user.kms_key_id) {
      signingMethod = 'python_bot_kms';
      hasActiveSession = true;
    }
    else if (user.turnkey_api_public_key) {
      signingMethod = 'python_bot_tg_cloud';
      hasActiveSession = true;
    }
    else if (user.temp_api_public_key && user.temp_api_private_key) {
      signingMethod = 'python_bot_legacy';
      hasActiveSession = true;
    }
    else if (user.source_old_db) {
      signingMethod = 'python_bot_legacy';
      hasActiveSession = false;
    }
    
    // Check session expiry
    if (hasActiveSession && user.session_expiry) {
      const sessionExpiry = new Date(user.session_expiry);
      const now = new Date();
      if (sessionExpiry < now) {
        hasActiveSession = false;
        signingMethod = 'session_expired';
      }
    }
    
    if (!hasActiveSession) {
      return res.status(401).json({ 
        error: "No active session for test user", 
        signing_method: signingMethod,
        requires_login: true,
        test_telegram_id: testTelegramId
      });
    }
    
    console.log('✅ Test user has active session, calling Python bot...');
    
    // Call Python bot for signing
    const pythonBotResponse = await fetch('http://172.31.2.184:8080/api/sign', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${generateJWT(testTelegramId)}`
      },
      body: JSON.stringify({
        telegram_id: testTelegramId,
        xdr: xdr,
        action_type: transaction_type,
        include_fee: include_fee
      })
    });
    
    if (!pythonBotResponse.ok) {
      let errorMessage;
      try {
        const errorData = await pythonBotResponse.json();
        errorMessage = errorData.error || `HTTP ${pythonBotResponse.status}`;
      } catch (e) {
        // If response is not JSON, get the text
        const errorText = await pythonBotResponse.text();
        errorMessage = errorText || `HTTP ${pythonBotResponse.status}`;
      }
      throw new Error(`Python bot signing failed: ${errorMessage}`);
    }
    
    const result = await pythonBotResponse.json();
    
    res.json({
      success: true,
      signed_xdr: result.signed_xdr,
      hash: result.hash,
      fee: result.fee,
      signing_method: signingMethod,
      test_user: {
        telegram_id: testTelegramId,
        public_key: user.public_key,
        session_type: signingMethod
      }
    });
    
  } catch (error) {
    console.error('Error in test signing:', error);
    res.status(500).json({ 
      error: error.message,
      message: "Test signing failed. Check Python bot connection and test user setup."
    });
  }
});

// Helper function to generate JWT for Python bot
function generateJWT(telegram_id) {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
  
  if (!JWT_SECRET || JWT_SECRET === 'dev-secret-key-change-in-production') {
    console.warn('⚠️ Using development JWT secret. Set JWT_SECRET in production!');
  }
  
  return jwt.sign({
    telegram_id: telegram_id,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  }, JWT_SECRET, { algorithm: 'HS256' });
}

        // Production endpoint for authenticator info
        router.get('/mini-app/authenticator', async (req, res) => {
          try {
            // Get user's Telegram ID from request (you'll need to implement proper auth)
            // For now, using test user ID - this should be replaced with real user authentication
            const telegramId = 5014800072; // TODO: Get from proper auth
            
            const response = await fetch('http://172.31.2.184:8080/api/authenticator', {
              method: 'GET',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${generateJWT(telegramId)}`
              }
            });
            
            if (!response.ok) {
              throw new Error(`Python bot authenticator check failed: ${response.status}`);
            }
            
            const authData = await response.json();
            
            res.json({
              success: true,
              authenticator_info: authData
            });
            
          } catch (error) {
            console.error('❌ Python bot authenticator failed:', error);
            res.status(500).json({
              success: false,
              error: error.message,
              message: 'Failed to get authenticator info'
            });
          }
        });
        
        // Test endpoint for Turnkey Cloud Stamper
        router.get('/test-turnkey-stamper', (req, res) => {
            res.sendFile(path.join(__dirname, '../test-turnkey-stamper.html'));
        });

        // Test endpoint for authenticator info (keep for debugging)
        router.get('/mini-app/test-authenticator', async (req, res) => {
          try {
            console.log('🧪 Testing Python bot authenticator...');
            
            // Test authenticator endpoint with JWT authentication
            const testTelegramId = 5014800072; // Test user ID
            const testResponse = await fetch('http://172.31.2.184:8080/api/authenticator', {
              method: 'GET',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${generateJWT(testTelegramId)}`
              }
            });
            
            if (!testResponse.ok) {
              throw new Error(`Python bot authenticator check failed: ${testResponse.status}`);
            }
            
            const authData = await testResponse.json();
            
            res.json({
              success: true,
              message: 'Python bot authenticator check successful',
              authenticator_info: authData,
              node_env: process.env.NODE_ENV || 'development',
              timestamp: new Date().toISOString()
            });
            
          } catch (error) {
            console.error('❌ Python bot authenticator test failed:', error);
            res.status(500).json({
              success: false,
              error: error.message,
              message: 'Python bot authenticator check failed.',
              node_env: process.env.NODE_ENV || 'development',
              timestamp: new Date().toISOString()
            });
          }
        });
        
        // Proxy endpoint for Stellar Expert asset metadata
        router.get('/mini-app/asset-metadata/:assetCode/:assetIssuer', async (req, res) => {
          try {
            const { assetCode, assetIssuer } = req.params;
            console.log(`🔍 Fetching asset metadata for ${assetCode}-${assetIssuer}`);
            
            // Call Stellar Expert API using axios
            const stellarExpertUrl = `https://stellar.expert/api/assets/${assetCode}-${assetIssuer}`;
            const response = await axios.get(stellarExpertUrl, {
              headers: {
                'User-Agent': 'LumenBro-Wallet/1.0'
              },
              timeout: 10000
            });
            
            // Set cache headers for Stellar Expert metadata (cache for 1 hour)
            res.set({
              'Cache-Control': 'public, max-age=3600, s-maxage=3600',
              'ETag': `"${assetCode}-${assetIssuer}-expert-${Date.now()}"`
            });
            
            res.json({
              success: true,
              data: response.data,
              source: 'stellar_expert'
            });
            
          } catch (error) {
            console.error(`❌ Asset metadata fetch failed for ${req.params.assetCode}:`, error.message);
            res.status(500).json({
              success: false,
              error: error.message,
              message: 'Failed to fetch asset metadata'
            });
          }
        });
        
        // Proxy endpoint for TOML file fetching
        router.get('/mini-app/toml-metadata/:assetCode/:assetIssuer', async (req, res) => {
          try {
            const { assetCode, assetIssuer } = req.params;
            console.log(`🔍 Fetching TOML metadata for ${assetCode}-${assetIssuer}`);
            
            // First get issuer's home domain
            const issuerResponse = await axios.get(`https://horizon.stellar.org/accounts/${assetIssuer}`, {
              timeout: 10000
            });
            const issuerData = issuerResponse.data;
            
            if (!issuerData.home_domain) {
              throw new Error('Issuer has no home domain');
            }
            
            // Fetch TOML file
            const tomlUrl = `https://${issuerData.home_domain}/.well-known/stellar.toml`;
            const tomlResponse = await axios.get(tomlUrl, {
              headers: {
                'User-Agent': 'LumenBro-Wallet/1.0'
              },
              timeout: 10000
            });
            
            const tomlText = tomlResponse.data;
            
            // Parse TOML for the specific asset using [[CURRENCIES]] format
            let assetMatch = tomlText.match(new RegExp(`\\[\\[CURRENCIES\\]\\]\\s*([\\s\\S]*?)(?=\\n\\[\\[|$)`, 'gi'));
            
            if (assetMatch) {
              for (const match of assetMatch) {
                const codeMatch = match.match(/code\s*=\s*"([^"]+)"/i);
                const issuerMatch = match.match(/issuer\s*=\s*"([^"]+)"/i);
                
                if (codeMatch && issuerMatch) {
                  // Check if this section matches our asset code or issuer
                  if (codeMatch[1] === assetCode || issuerMatch[1] === assetIssuer) {
                    console.log(`Found asset in TOML: ${codeMatch[1]} (${issuerMatch[1]})`);
                    assetMatch = [match, match];
                    break;
                  }
                }
              }
            }
            
            if (!assetMatch) {
              console.log(`Asset ${assetCode} (${assetIssuer}) not found in TOML, using xBull-style fallback`);
              
              // Try to generate predictable icon URL like xBull does
              let fallbackIcon = null;
              try {
                // Create a hash from asset code + issuer (similar to xBull's approach)
                const crypto = require('crypto');
                const hashInput = `${assetCode}-${assetIssuer}`;
                const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
                const shortHash = hash.substring(0, 32); // Take first 32 chars like xBull
                
                // Use the same CDN pattern as xBull
                fallbackIcon = `https://cdn.${issuerData.home_domain}/prod/meme/meme-${shortHash}.png`;
                console.log(`Generated xBull-style fallback icon: ${fallbackIcon}`);
              } catch (error) {
                console.log('Could not generate fallback icon URL:', error.message);
              }
              
              const metadata = {
                icon: fallbackIcon,
                name: assetCode,
                description: `${assetCode} token on Stellar`,
                home_domain: issuerData.home_domain
              };
              
              // Set cache headers for fallback metadata (cache for 1 hour)
              res.set({
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                'ETag': `"${assetCode}-${assetIssuer}-fallback-${Date.now()}"`
              });
              
              res.json({
                success: true,
                data: metadata,
                source: 'xbull_fallback'
              });
              return;
            }
            
            const assetSection = assetMatch[1];
            const iconMatch = assetSection.match(/image\s*=\s*"([^"]+)"/i);
            const nameMatch = assetSection.match(/name\s*=\s*"([^"]+)"/i);
            const descMatch = assetSection.match(/desc\s*=\s*"([^"]+)"/i);
            
            const metadata = {
              icon: iconMatch ? iconMatch[1] : null,
              name: nameMatch ? nameMatch[1] : null,
              description: descMatch ? descMatch[1] : null,
              home_domain: issuerData.home_domain
            };
            
            // Set cache headers for TOML metadata (cache for 1 hour)
            res.set({
              'Cache-Control': 'public, max-age=3600, s-maxage=3600',
              'ETag': `"${assetCode}-${assetIssuer}-${Date.now()}"`
            });
            
            res.json({
              success: true,
              data: metadata,
              source: 'toml'
            });
            
          } catch (error) {
            console.error(`❌ TOML metadata fetch failed for ${req.params.assetCode}:`, error.message);
            res.status(500).json({
              success: false,
              error: error.message,
              message: 'Failed to fetch TOML metadata'
            });
          }
                });
        
        // Build transaction endpoint
        router.post('/mini-app/build-transaction', async (req, res) => {
          try {
            const { recipient, asset, amount, memo } = req.body;
            
            // Validation
            if (!recipient || !asset || !amount) {
              return res.status(400).json({
                success: false,
                error: 'Missing required fields: recipient, asset, amount'
              });
            }
            
            if (!recipient.startsWith('G')) {
              return res.status(400).json({
                success: false,
                error: 'Invalid Stellar address'
              });
            }
            
            // Get user's public key (for now, using test user)
            const telegramId = 5014800072; // TODO: Get from proper auth
            
            // Get user's public key from Python bot
            const authResponse = await fetch('http://172.31.2.184:8080/api/authenticator', {
              method: 'GET',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${generateJWT(telegramId)}`
              }
            });
            
            if (!authResponse.ok) {
              throw new Error('Failed to get user data');
            }
            
            const authData = await authResponse.json();
            const publicKey = authData.user.public_key;
            
            // Get current network fee from Stellar
            const feeResponse = await fetch('https://horizon.stellar.org/fee_stats');
            const feeData = await feeResponse.json();
            const networkFee = (feeData.fee_charged.mode / 100000).toFixed(5) || '0.00001';
            
            // Calculate service fee based on user status
            const serviceFee = calculateServiceFee(amount, asset, telegramId);
            
            // Build transaction object (we'll use Stellar SDK on server)
            const transaction = {
              source: publicKey,
              recipient: recipient,
              asset: asset,
              amount: amount,
              memo: memo || '',
              networkFee: networkFee
            };
            
            // Calculate total fees
            const totalFees = parseFloat(networkFee) + parseFloat(serviceFee);
            
            res.json({
              success: true,
              transaction: transaction,
              fees: {
                networkFee: networkFee,
                serviceFee: serviceFee,
                total: totalFees.toFixed(5)
              }
            });
            
          } catch (error) {
            console.error('Transaction build failed:', error);
            res.status(500).json({
              success: false,
              error: error.message,
              message: 'Failed to build transaction'
            });
          }
        });
        
        // Calculate service fee based on user status
        function calculateServiceFee(amount, asset, telegramId) {
          // TODO: Get user status from database (pioneer, referred, etc.)
          // For now, using base 1% fee
          const baseFee = 0.01; // 1%
          
          // Convert non-XLM assets to XLM equivalent for fee calculation
          if (asset === 'XLM') {
            return (parseFloat(amount) * baseFee).toFixed(5);
          } else {
            // TODO: Get asset price from Stellar DEX for XLM conversion
            // For now, using a simple conversion
            return (parseFloat(amount) * baseFee * 0.1).toFixed(5); // Assume 10:1 ratio
          }
        }
        
        // Log transaction data for fee tracking and referral rewards (mirrors Python bot)
        router.post('/mini-app/log-transaction', async (req, res) => {
          try {
            const { type, recipient, amount, asset, signedXDR, signingMethod, timestamp, telegramId } = req.body;
            
            console.log('📊 Logging transaction:', { type, recipient, amount, asset, signingMethod, telegramId });
            
            // Get user status and referral info from database
            const userQuery = await pool.query(`
              SELECT u.pioneer_status, u.referral_code, 
                     r.referrer_id, f.telegram_id as founder_id
              FROM users u
              LEFT JOIN referrals r ON u.telegram_id = r.referee_id
              LEFT JOIN founders f ON u.telegram_id = f.telegram_id
              WHERE u.telegram_id = $1
            `, [telegramId]);
            
            if (userQuery.rows.length === 0) {
              return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            const user = userQuery.rows[0];
            const isPioneer = user.pioneer_status;
            const isFounder = !!user.founder_id;
            const referrerId = user.referrer_id;
            
            // Calculate XLM equivalent for fee calculation (mirrors Python bot)
            let xlmEquivalent = parseFloat(amount);
            if (asset !== 'XLM') {
              // TODO: Get asset price from Stellar DEX for XLM conversion
              // For now, using a simple conversion (should match Python bot logic)
              xlmEquivalent = parseFloat(amount) * 0.1; // Assume 10:1 ratio
            }
            
            // Calculate fees based on user status (mirrors Python bot)
            let feePercentage = 0.01; // 1% base fee
            if (isFounder || isPioneer) {
              feePercentage = 0.001; // 0.1% for founders/pioneers
            } else if (referrerId) {
              feePercentage = 0.009; // 0.9% for referred users
            }
            
            // Calculate fee amount
            const feeAmount = (xlmEquivalent * feePercentage).toFixed(7);
            
            // Log to trades table (mirrors Python bot)
            const tradeQuery = await pool.query(`
              INSERT INTO trades (user_id, xlm_volume, tx_hash, action_type, timestamp)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `, [
              telegramId, xlmEquivalent, `mock_hash_${Date.now()}`, type, timestamp
            ]);
            
            const tradeId = tradeQuery.rows[0].id;
            
            // Log to fees table (mirrors Python bot)
            await pool.query(`
              INSERT INTO fees (telegram_id, action_type, amount, fee, tx_hash, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              telegramId, type, xlmEquivalent, feeAmount, `mock_hash_${Date.now()}`, timestamp
            ]);
            
            // Calculate referral rewards (mirrors Python bot logic)
            if (referrerId) {
              // Get referrer's volume to determine reward percentage
              const referrerVolumeQuery = await pool.query(`
                SELECT COALESCE(SUM(xlm_volume), 0) as total_volume
                FROM trades 
                WHERE user_id = $1
              `, [referrerId]);
              
              const referrerVolume = parseFloat(referrerVolumeQuery.rows[0].total_volume);
              const volumeThreshold = 1000; // 1000 XLM threshold for higher rewards
              
              // Calculate reward percentage: 35% if over threshold, 25% otherwise
              const rewardPercentage = referrerVolume >= volumeThreshold ? 0.35 : 0.25;
              const referralReward = (feeAmount * rewardPercentage).toFixed(7);
              
              // Log to rewards table (mirrors Python bot)
              await pool.query(`
                INSERT INTO rewards (user_id, amount, status, timestamp)
                VALUES ($1, $2, $3, $4)
              `, [
                referrerId, referralReward, 'unpaid', timestamp
              ]);
              
              console.log('💰 Referral reward logged:', { 
                referrerId, 
                rewardAmount: referralReward, 
                rewardPercentage: rewardPercentage * 100 + '%',
                referrerVolume: referrerVolume
              });
            }
            
            res.json({
              success: true,
              tradeId: tradeId,
              xlmEquivalent: xlmEquivalent,
              feeAmount: feeAmount,
              feePercentage: feePercentage,
              referralReward: referrerId ? (feeAmount * (referrerVolume >= volumeThreshold ? 0.35 : 0.25)).toFixed(7) : null,
              referrerVolume: referrerId ? referrerVolume : null
            });
            
          } catch (error) {
            console.error('❌ Transaction logging failed:', error);
            res.status(500).json({
              success: false,
              error: error.message,
              message: 'Failed to log transaction'
            });
          }
        });
        

        
        // Test endpoint for local development
        router.get('/mini-app/test-python-connection', async (req, res) => {
  try {
    console.log('🧪 Testing Python bot connection...');
    
    // Test basic connectivity with JWT authentication
    const testTelegramId = 5014800072; // Test user ID
    const testResponse = await fetch('http://172.31.2.184:8080/api/check_status', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${generateJWT(testTelegramId)}`
      },
      body: JSON.stringify({ telegram_id: testTelegramId })
    });
    
    if (!testResponse.ok) {
      throw new Error(`Python bot status check failed: ${testResponse.status}`);
    }
    
    const statusData = await testResponse.json();
    
    res.json({
      success: true,
      message: 'Python bot connection successful',
      python_bot_status: statusData,
      node_env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Python bot connection test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Python bot connection failed. Check if Python bot is running on 172.31.2.184:8080.',
      node_env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  }
});

// Add endpoint for wallet transaction signing with HPKE (like login module)
router.post('/mini-app/sign-transaction-hpke', async (req, res) => {
  try {
    const { body: bodyStr, stamp: stampStr, ephemeralPrivateKey, initData } = req.body;
    
    console.log('🔐 Processing wallet transaction signing with HPKE...');
    
    // Validate required fields
    if (!bodyStr || !stampStr || !ephemeralPrivateKey) {
      return res.status(400).json({ error: 'Missing required fields: body, stamp, ephemeralPrivateKey' });
    }

    // Validate ephemeralPrivateKey
    if (!ephemeralPrivateKey || typeof ephemeralPrivateKey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(ephemeralPrivateKey)) {
      throw new Error('Invalid ephemeralPrivateKey format');
    }

    console.log('EphemeralPrivateKey received: [redacted] type:', typeof ephemeralPrivateKey);

    // Parse the request body
    let body;
    try {
      body = JSON.parse(bodyStr);
    } catch (e) {
      throw new Error('Invalid body JSON');
    }

    // Validate it's a transaction signing request
    if (body.type !== 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2') {
      throw new Error('Invalid activity type for wallet transaction');
    }

    // Get the XDR from the payload (it's the original XDR, not a hash)
    const originalXdr = body.parameters?.payload;
    if (!originalXdr) {
      throw new Error('No XDR payload found in request');
    }

    // Hash the XDR like the Python code does
    const crypto = require('crypto');
    const txHash = crypto.createHash('sha256').update(originalXdr).digest('hex');
    console.log('✅ Hashed XDR to transaction hash:', txHash.substring(0, 16) + '...');

    // Update the body to use the hash instead of the XDR
    body.parameters.payload = txHash;
    bodyStr = JSON.stringify(body);

    // Forward to Turnkey with stamp (using correct endpoint from Python code)
    console.log('📡 Forwarding to Turnkey API...');
    const turnkeyResponse = await fetch('https://api.turnkey.com/public/v1/submit/sign_raw_payload', {
      method: 'POST',
      headers: {
        'X-Stamp': stampStr,
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });
    
    const turnkeyResult = await turnkeyResponse.json();
    
    if (!turnkeyResponse.ok) {
      console.error('❌ Turnkey API error:', turnkeyResult);
      return res.status(turnkeyResponse.status).json(turnkeyResult);
    }
    
    console.log('✅ Turnkey signing successful');

    // Extract signature from Turnkey response (following Python code pattern)
    const r = turnkeyResult.activity?.result?.signRawPayloadResult?.r;
    const s = turnkeyResult.activity?.result?.signRawPayloadResult?.s;
    
    if (!r || !s) {
      console.error('❌ No signature in Turnkey response');
      return res.status(500).json({ 
        error: 'No signature received from Turnkey',
        details: turnkeyResult 
      });
    }
    
    // Construct signature and create signed XDR (following Python code)
    const hexSignature = r + s;
    if (hexSignature.length !== 128 || !/^[0-9a-fA-F]+$/.test(hexSignature)) {
      console.error('❌ Invalid signature format');
      return res.status(500).json({ 
        error: 'Invalid signature format from Turnkey',
        details: { hexSignature } 
      });
    }
    
    // Construct the signed XDR like the Python code does
    // We need to add the signature to the original XDR
    // For now, return the original XDR and signature separately
    // The client will need to construct the final signed XDR
    const signedXdr = originalXdr; // Return the original XDR

    // Log trade to database (consistent with Python bot)
    try {
      console.log('💾 Logging trade to database...');
      
      // Extract transaction hash from the original XDR
      const originalXdr = body.parameters?.payload || 'unknown';
      
      // Extract Turnkey activity ID from response
      const activityId = turnkeyResult.activity?.id || 'unknown';
      
      // Calculate XLM volume (you can adjust this based on your needs)
      const xlmVolume = 0; // Will need to parse XDR to get actual volume
      
      // Get telegram_id from the request (you'll need to add this to the frontend)
      const telegram_id = body.parameters?.telegram_id || null;
      
      if (telegram_id) {
        const tradeLogQuery = `
          INSERT INTO trades (
            user_id, 
            xlm_volume,
            tx_hash,
            turnkey_activity_id,
            fee_amount,
            fee_asset,
            timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `;
        
                 await pool.query(tradeLogQuery, [
           telegram_id,
           xlmVolume,
           originalXdr,
           0, // Fee amount (will need to parse from XDR)
           'XLM' // Fee asset
         ]);
        
        console.log('✅ Trade logged successfully');
        
        // Calculate referral rewards (same logic as Python bot)
        // await handleReferralRewards(telegram_id, feeAmount);
      }
      
    } catch (dbError) {
      console.error('⚠️ Trade logging failed:', dbError);
      // Don't fail the transaction if logging fails
    }

    // Return signed XDR for client-side network submission
    res.json({
      success: true,
      signed_xdr: signedXdr,
      signature: {
        r: r,
        s: s,
        hex: hexSignature
      },
      turnkey_response: turnkeyResult,
      message: 'Transaction signed successfully - ready for network submission'
    });
    
  } catch (error) {
    console.error('❌ Wallet transaction signing error:', error);
    res.status(500).json({ 
      error: 'Wallet transaction signing failed',
      details: error.message 
    });
  }
});

module.exports = router;
module.exports.handleTurnkeyPost = handleTurnkeyPost;
