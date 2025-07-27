// routes/login.js - Backend for login/session creation
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { hpkeDecrypt } = require('@turnkey/crypto'); // Ensure @turnkey/crypto is installed
const fetch = require('node-fetch');
const crypto = require('crypto');

// Fetch BOT_TOKEN from env for initData validation (if using Mini App)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Function to validate Telegram initData (for Mini App security)
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

// HPKE suite
const hpkeSuite = {
  kem: 'p256-hkdf-sha256',
  kdf: 'hkdf-sha256',
  aead: 'aes-128-gcm'
};

// Existing /login GET if needed (legacy)
router.get('/login', (req, res) => {
  const email = req.query.email || 'unknown@lumenbro.com';
  const orgId = req.query.orgId;
  if (!orgId) return res.status(400).json({ error: "Missing orgId" });
  res.render('login', { email, org_id: orgId });
});

// New endpoint to fetch userId (called by client)
router.get('/get-user-id', async (req, res) => {
  const { orgId } = req.query;
  try {
    const userRes = await pool.query(
      "SELECT u.turnkey_user_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_sub_org_id = $1",
      [orgId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    res.json({ userId: userRes.rows[0].turnkey_user_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Adapted for Mini App: POST /mini-app/create-session (use API key stamp, not WebAuthn)
router.post('/mini-app/create-session', async (req, res) => {
  const { body: bodyStr, stamp: stampStr, ephemeralPrivateKey, initData } = req.body;  // Added initData for validation

  if (!validateInitData(initData)) {
    return res.status(403).json({ error: "Invalid initData" });
  }

  try {
    // Proxy to Turnkey with general X-Stamp header (for API keys; keep X-Stamp-Webauthn as optional legacy)
    const turnkeyRes = await fetch('https://api.turnkey.com/public/v1/submit/create_read_write_session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Stamp': stampStr  // Use X-Stamp for API key stamping (or X-Stamp-Webauthn if legacy WebAuthn)
      },
      body: bodyStr
    });

    if (!turnkeyRes.ok) throw new Error(`Turnkey error: ${await turnkeyRes.text()}`);

    const data = await turnkeyRes.json();
    const credentialBundle = data.activity.result.createReadWriteSessionResultV2.credentialBundle;
    const sessionId = data.activity.result.createReadWriteSessionResultV2.apiKeyId;

    // Parse and decrypt bundle
    const bundleData = JSON.parse(Buffer.from(credentialBundle, 'base64').toString('utf8'));
    const encapsulatedPublic = Buffer.from(bundleData.encapsulatedPublic, 'base64');
    const ciphertext = Buffer.from(bundleData.ciphertext, 'base64');
    const decrypted = await hpkeDecrypt({
      suite: hpkeSuite,
      recipientPrivateKey: Buffer.from(ephemeralPrivateKey, 'hex'),
      encapsulatedKey: encapsulatedPublic,
      ciphertext,
      associatedData: Buffer.from('turnkey session', 'utf8')
    });
    const decryptedData = JSON.parse(Buffer.from(decrypted).toString('utf8'));
    const apiPublicKey = decryptedData.publicKey;
    const apiPrivateKey = decryptedData.privateKey;

    // Parse orgId from bodyStr (for telegramId query)
    const bodyObj = JSON.parse(bodyStr);
    const orgId = bodyObj.organizationId;

    // Get telegramId
    const userRes = await pool.query(
      "SELECT telegram_id FROM turnkey_wallets WHERE turnkey_sub_org_id = $1",
      [orgId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    const telegramId = userRes.rows[0].telegram_id;

    // Calculate expiry
    const expirationSeconds = 31536000;
    const sessionExpiry = new Date(Date.now() + expirationSeconds * 1000).toISOString();

    // Store in DB
    await pool.query(
      "UPDATE users SET temp_api_public_key = $1, temp_api_private_key = $2, turnkey_session_id = $3, session_expiry = $4 WHERE telegram_id = $5",
      [apiPublicKey, apiPrivateKey, sessionId, sessionExpiry, telegramId]
    );

    res.json({ success: true });
  } catch (e) {
    console.error(`Login auth failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
