const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const turnkeyClient = require('../turnkeyClient');
const axios = require('axios');
const crypto = require('crypto'); // Built-in, for random/challenges if needed

async function createTurnkeySubOrg(telegramId, email, challenge, attestation) {
  const params = {
    subOrganizationName: `User-${telegramId}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `User-${telegramId}`,
        userEmail: email,
        apiKeys: [],
        authenticators: [
          {
            authenticatorName: "Passkey",
            challenge,
            attestation
          }
        ],
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
  const subOrgId = response.activity.result.createSubOrganizationResult.subOrganizationId;
  const wallet = response.activity.result.createSubOrganizationResult.wallet;
  const keyId = wallet.walletId;
  const publicKey = wallet.addresses[0];
  const rootUserId = response.activity.result.createSubOrganizationResult.rootUserIds[0]; // Store for later use
  if (!subOrgId || !keyId || !publicKey || !rootUserId) {
    throw new Error("Missing data in Turnkey response");
  }
  return { subOrgId, keyId, publicKey, rootUserId };
}

async function handleTurnkeyPost(telegramId, referrerId, email, challenge, attestation) {
  const existing = await pool.query(
    "SELECT turnkey_sub_org_id, turnkey_key_id, public_key FROM turnkey_wallets WHERE telegram_id = $1 AND is_active = TRUE",
    [telegramId]
  );
  if (existing.rows.length > 0) {
    console.log(`Existing sub-org found for ${telegramId}`);
    return { subOrgId: existing.rows[0].turnkey_sub_org_id, email };
  }

  const { subOrgId, keyId, publicKey, rootUserId } = await createTurnkeySubOrg(telegramId, email, challenge, attestation);

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
    text: "Passkey setup complete! Use /start in the bot."
  });

  return { subOrgId, email };
}

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
    const { email, challenge, attestation } = req.body;
    if (!email || !challenge || !attestation) return res.status(400).json({ error: "Missing data" });
    const { subOrgId } = await handleTurnkeyPost(telegramId, referrerId, email, challenge, attestation);
    res.json({ success: true, sub_org_id: subOrgId });
  } catch (e) {
    console.error(`Auth failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
