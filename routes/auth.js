// routes/auth.js - Backend for registration, adapted for Mini App
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const turnkeyClient = require('../turnkeyClient');
const axios = require('axios');
const crypto = require('crypto');

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

// Updated to use API public key for root user, no authenticators
async function createTurnkeySubOrg(telegram_id, email, apiPublicKey) {
  const params = {
    subOrganizationName: `User ${telegram_id}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: email,
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

// POST /mini-app/clear – Clear DB state for user
router.post('/mini-app/clear', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const client = await pool.connect();
    await client.query('BEGIN');
    // Clear or deactivate wallet/user data
    await client.query("UPDATE turnkey_wallets SET is_active = FALSE WHERE telegram_id = $1", [telegram_id]);
    await client.query("UPDATE users SET public_key = NULL, user_email = NULL, turnkey_user_id = NULL WHERE telegram_id = $1", [telegram_id]);
    await client.query('COMMIT');
    client.release();
    res.json({ success: true });
  } catch (e) {
    console.error(`Clear failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.handleTurnkeyPost = handleTurnkeyPost;
