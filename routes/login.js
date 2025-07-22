// Full revised login.js with postActivity and parsing
const express = require('express');
const router = express.Router();
const pool = require('../db');
const turnkey = require('../turnkeyClient'); // Updated to 'turnkey'
const crypto = require('crypto');

router.get('/login', (req, res) => {
  const email = req.query.email || 'unknown@lumenbro.com';
  const orgId = req.query.orgId;
  if (!orgId) return res.status(400).json({ error: "Missing orgId" });
  res.render('login', { email, org_id: orgId });
});

router.post('/login-auth', async (req, res) => {
  const { orgId, challenge, assertion } = req.body;
  if (!orgId || !challenge || !assertion) return res.status(400).json({ error: "Missing data" });
  try {
    const userRes = await pool.query(
      "SELECT u.turnkey_user_id, u.telegram_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_sub_org_id = $1",
      [orgId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    const userId = userRes.rows[0].turnkey_user_id;
    const telegramId = userRes.rows[0].telegram_id;

    const ecdh = crypto.createECDH('secp256r1');
    ecdh.generateKeys();
    const targetPublicKey = ecdh.getPublicKey('hex', 'uncompressed');

    const params = {
      targetPublicKey,
      userId,
      apiKeyName: "BotSession",
      expirationSeconds: "31536000",
      invalidateExisting: false,
      webauthnAssertion: {
        response: {
          authenticatorData: assertion.authenticatorData,
          clientDataJSON: assertion.clientDataJson,
          signature: assertion.signature,
          userHandle: assertion.userHandle
        },
        rawId: assertion.credentialId,
        type: "public-key"
      }
    };
    const response = await turnkey.serverClient().postActivity({
      type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
      timestampMs: String(Date.now()),
      organizationId: orgId,
      parameters: params
    });
    const resultV2 = response.activity.result.createReadWriteSessionResultV2;
    const credentialBundle = resultV2.credentialBundle;
    const sessionId = resultV2.apiKeyId; // Or use another field if needed for session tracking

    // Store session in DB
    await pool.query(
      "UPDATE users SET turnkey_session_id = $1 WHERE telegram_id = $2",
      [credentialBundle, telegramId] // Assuming credentialBundle is what to store; adjust if needed
    );

    res.json({ success: true });
  } catch (e) {
    console.error(`Login auth failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
