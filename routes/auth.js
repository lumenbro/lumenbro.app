// routes/auth.js - Backend for registration, adapted for Mini App
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const turnkeyClient = require('../turnkeyClient'); // Renamed to avoid conflict
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

// Updated to use API public key for root user, no authenticators
async function createTurnkeySubOrg(telegramId, email, apiPublicKey) {
  const params = {
    subOrganizationName: `User-${telegramId}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `User-${telegramId}`,
        userEmail: email,
        apiKeys: [
          {
            apiKeyName: `User-${telegramId}-APIKey`,
            publicKey: apiPublicKey,
            curveType: "API_KEY_CURVE_P256"
          }
        ],
        authenticators: [],  // No passkey
        oauthProviders: []
      }
    ],
    wallet: {
      walletName: `Stellar-Wallet-${telegramId}`,
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
  const subOrgId = response.subOrganizationId;
  const wallet = response.wallet;
  const keyId = wallet.walletId;
  const publicKey = wallet.addresses[0].address; // Adjusted for response structure
  const rootUserId = response.rootUserIds[0]; // Assuming single root user
  if (!subOrgId || !keyId || !publicKey || !rootUserId) {
    throw new Error("Missing data in Turnkey response");
  }
  return { subOrgId, keyId, publicKey, rootUserId };
}

// Updated handle: No challenge/attestation, add apiPublicKey
async function handleTurnkeyPost(telegramId, referrerId, email, apiPublicKey) {
  const existing = await pool.query(
    "SELECT turnkey_sub_org_id, turnkey_key_id, public_key FROM turnkey_wallets WHERE telegram_id = $1 AND is_active = TRUE",
    [telegramId]
  );
  if (existing.rows.length > 0) {
    console.log(`Existing sub-org found for ${telegramId}`);
    return { subOrgId: existing.rows[0].turnkey_sub_org_id, email };
  }

  const { subOrgId, keyId, publicKey, rootUserId } = await createTurnkeySubOrg(telegramId, email, apiPublicKey);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query("SELECT * FROM users WHERE telegram_id = $1", [telegramId]);
    if (userRes.rows.length === 0) {
      await client.query(
        "INSERT INTO users (telegram_id, referral_code) VALUES ($1, $2)",
        [telegramId, String(telegramId).slice(-6)]
      );
      if (referrerId) {
        await client.query(
          "INSERT INTO referrals (referee_id, referrer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [telegramId, referrerId]
        );
      }
    }
    await client.query(
      "INSERT INTO turnkey_wallets (telegram_id, turnkey_sub_org_id, turnkey_key_id, public_key, is_active) " +
      "VALUES ($1, $2, $3, $4, TRUE) " +
      "ON CONFLICT (telegram_id, turnkey_key_id) DO UPDATE SET turnkey_sub_org_id = $2, public_key = $4, is_active = TRUE",
      [telegramId, subOrgId, keyId, publicKey]
    );
    await client.query(
      "UPDATE users SET public_key = $1, user_email = $2, turnkey_user_id = $3 WHERE telegram_id = $4",
      [publicKey, email, rootUserId, telegramId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: telegramId,
    text: "Setup complete! Use /start in the bot."
  });

  return { subOrgId, email };
}

// Adapted for Mini App: POST /mini-app/create-sub-org (API key only)
router.post('/mini-app/create-sub-org', async (req, res) => {
  const { telegram_id, initData, email, apiPublicKey, referrer_id } = req.body;

  if (!validateInitData(initData)) {
    return res.status(403).json({ error: "Invalid initData" });
  }

  let referrerId = referrer_id || null;

  try {
    const { subOrgId } = await handleTurnkeyPost(telegram_id, referrerId, email, apiPublicKey);
    res.json({ subOrgId });
  } catch (e) {
    console.error(`Create sub-org failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// Existing /turnkey-auth routes if needed for non-mini-app (optional: update to API keys if keeping)
router.get('/turnkey-auth', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: "Missing token" });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.render('auth');
  } catch (e) {
    console.error(`Invalid token: ${e.message}`);
    res.status(400).json({ error: "Invalid token" });
  }
});

router.post('/turnkey-auth', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const telegramId = payload.telegram_id;
    const referrerId = payload.referrer_id || null;
    const { email, apiPublicKey } = req.body;  // Updated: apiPublicKey instead of challenge/attestation
    if (!email || !apiPublicKey) return res.status(400).json({ error: "Missing data" });
    const { subOrgId } = await handleTurnkeyPost(telegramId, referrerId, email, apiPublicKey);
    res.json({ success: true, sub_org_id: subOrgId });
  } catch (e) {
    console.error(`Auth failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
