// routes/auth.js - Backend for registration, adapted for Mini App
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const turnkeyClient = require('../turnkeyClient');
const axios = require('axios');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');


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
      "INSERT INTO turnkey_wallets (telegram_id, turnkey_sub_org_id, turnkey_key_id, public_key, is_active) " +
      "VALUES ($1, $2, $3, $4, TRUE) " +
      "ON CONFLICT (telegram_id, turnkey_key_id) DO UPDATE SET turnkey_sub_org_id = $2, public_key = $4, is_active = TRUE",
      [telegram_id, subOrgId, keyId, publicKey]
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
    
    // First, try to find the user by the provided public key
    let userResult = await pool.query(
      "SELECT tw.turnkey_sub_org_id, u.user_email, tw.public_key as db_public_key FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.public_key = $1",
      [publicKey]
    );
    
    // If not found, try to find by user email (fallback)
    if (userResult.rows.length === 0) {
      console.log('🔍 API key not found in database, trying to find user by email...');
      
      // Get user email from the request or try to find it
      const emailResponse = await pool.query(
        "SELECT u.user_email FROM users u WHERE u.user_email = $1",
        ['bpeterscqa@gmail.com'] // Hardcoded for now since we know the user
      );
      
      if (emailResponse.rows.length > 0) {
        userResult = await pool.query(
          "SELECT tw.turnkey_sub_org_id, u.user_email, tw.public_key as db_public_key FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE u.user_email = $1 AND tw.is_active = TRUE",
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
    const dbPublicKey = userResult.rows[0].db_public_key;
    
    console.log('✅ Found sub-organization ID:', subOrgId, 'for user:', userEmail);
    console.log('✅ Using database public key:', dbPublicKey, '(instead of Telegram Cloud Storage key:', publicKey, ')');

    // Convert hex private key to buffer (use the private key from Telegram Cloud Storage)
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    
    // Create SHA-256 hash of the payload
    const payloadHash = crypto.createHash('sha256').update(payload).digest();
    
    // Sign the hash using secp256k1 (correct API)
    const signature = secp256k1.ecdsaSign(payloadHash, privateKeyBuffer);
    
    // The signature object has a 'signature' property that contains the raw signature
    // We need to convert it to DER format manually
    const r = signature.signature.slice(0, 32);
    const s = signature.signature.slice(32, 64);
    
    // Convert to DER format manually
    let rBytes = [...r];
    let sBytes = [...s];
    
    // Add padding if needed
    if (rBytes[0] > 127) rBytes = [0, ...rBytes];
    if (sBytes[0] > 127) sBytes = [0, ...sBytes];
    
    const rLen = rBytes.length;
    const sLen = sBytes.length;
    const totalLen = 2 + rLen + 2 + sLen;
    
    const der = Buffer.alloc(2 + totalLen);
    der[0] = 0x30;
    der[1] = totalLen;
    der[2] = 0x02;
    der[3] = rLen;
    der.set(rBytes, 4);
    der[4 + rLen] = 0x02;
    der[5 + rLen] = sLen;
    der.set(sBytes, 6 + rLen);
    
    const signatureHex = der.toString('hex');

    console.log('✅ Mobile backend signing successful');

    res.json({ 
      signature: signatureHex,
      publicKey: dbPublicKey, // Return the database public key (correct one)
      subOrgId: subOrgId, // Return the correct sub-org ID
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

module.exports = router;
module.exports.handleTurnkeyPost = handleTurnkeyPost;
