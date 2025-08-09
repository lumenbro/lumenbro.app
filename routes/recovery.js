const express = require('express');
const router = express.Router();
const turnkeyRequest = require('../turnkeyClient'); // This is the object with methods
const pool = require('../db');
const { Telegraf } = require('telegraf');
const { v4: uuidv4 } = require('uuid');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Standalone recovery page (no orgId needed)
router.get('/recovery', (req, res) => {
  const email = req.query.email;
  const orgId = req.query.orgId;
  
  // If no orgId, serve the standalone recovery page
  if (!orgId) {
    return res.sendFile('recovery.html', { root: './public' });
  }
  
  // Legacy mini-app recovery with orgId
  res.render('recovery', { email: email || 'unknown@lumenbro.com', org_id: orgId });
});

// New endpoint for standalone recovery: lookup orgId by email
router.post('/lookup-org-by-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  
  try {
    const userRes = await pool.query(
      "SELECT tw.turnkey_sub_org_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE u.user_email = $1 AND tw.is_active = TRUE",
      [email]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "No active wallet found for this email address" });
    }
    
    const orgId = userRes.rows[0].turnkey_sub_org_id;
    res.json({ orgId, email });
    
  } catch (e) {
    console.error(`Lookup org by email failed: ${e.message}`);
    res.status(500).json({ error: "Database error" });
  }
});

router.post('/init-recovery', async (req, res) => {
  const { orgId, email, targetPublicKey } = req.body;
  if (!orgId || !email || !targetPublicKey) return res.status(400).json({ error: "Missing orgId, email, or targetPublicKey" });
  try {
    let userId;
    const userRes = await pool.query(
      "SELECT u.turnkey_user_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_sub_org_id = $1",
      [orgId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found in database");
    userId = userRes.rows[0].turnkey_user_id;

    const data = {
      type: "ACTIVITY_TYPE_EMAIL_AUTH",
      organizationId: orgId,
      parameters: {
        email,
        targetPublicKey,
        apiKeyName: `Recovery API Key - ${email}`,
        expirationSeconds: "3600",
        emailCustomization: { 
          appName: "LumenBro",
          magicLinkTemplate: "We received a request to recover your LumenBro wallet. Use this code: {{authBundle}}"
        }
      }
    };
    console.log('Email Auth request data:', data);
    const response = await turnkeyRequest.emailAuth(data);
    const fetchedUserId = response.activity?.result?.emailAuthResult?.userId;  // Adjust if response structure differs
    if (fetchedUserId && fetchedUserId !== userId) {
      await pool.query("UPDATE users SET turnkey_user_id = $1 WHERE user_email = $2", [fetchedUserId, email]);
    }
    res.json({ success: true, userId: fetchedUserId || userId });
  } catch (e) {
    console.error(`Init recovery failed: ${e.message}\n${e.stack}`);
    res.status(500).json({ error: e.message });
  }
});

// New endpoint for OTP completion and passkey addition
router.post('/complete-otp-recovery', async (req, res) => {
  const { orgId, email, otpCode, newPasskey } = req.body;
  if (!orgId || !email || !otpCode || !newPasskey) {
    return res.status(400).json({ error: "Missing orgId, email, otpCode, or newPasskey" });
  }

  try {
    // Get user info
    const userRes = await pool.query(
      "SELECT u.turnkey_user_id, u.telegram_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_sub_org_id = $1",
      [orgId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found in database");
    
    const { turnkey_user_id: userId, telegram_id: telegramId } = userRes.rows[0];

    // Use the OTP code to add new authenticator (passkey)
    const addAuthData = {
      type: "ACTIVITY_TYPE_CREATE_AUTHENTICATORS",
      organizationId: orgId,
      parameters: {
        authenticators: [{
          authenticatorName: `Recovery Passkey - ${email}`,
          challenge: otpCode, // Use OTP as challenge
          attestation: newPasskey
        }]
      }
    };

    const addAuthResponse = await turnkeyRequest.addAuthenticator(addAuthData);
    
    if (addAuthResponse.activity?.result) {
      // Update database to mark recovery complete
      await pool.query(
        "UPDATE users SET migration_notified = TRUE, migration_notified_at = NOW() WHERE telegram_id = $1",
        [telegramId]
      );

      // Send success notification via Telegram
      const message = `🎉 Wallet recovery successful! Your new passkey has been added. You can now access your wallet through the bot or mini-app.`;
      await bot.telegram.sendMessage(telegramId, message);

      res.json({ 
        success: true, 
        authenticatorId: addAuthResponse.activity.result.createAuthenticatorsResult?.authenticatorIds?.[0],
        message: "Recovery completed successfully"
      });
    } else {
      throw new Error("Failed to add new authenticator");
    }

  } catch (e) {
    console.error(`Complete OTP recovery failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

router.post('/notify-recovery-complete', async (req, res) => {
  const { orgId, email, authenticatorId } = req.body;
  if (!orgId || !email || !authenticatorId) return res.status(400).json({ error: "Missing orgId, email, or authenticatorId" });
  try {
    const userRes = await pool.query(
      "SELECT telegram_id FROM users WHERE user_email = $1",
      [email]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    const telegramId = userRes.rows[0].telegram_id;

    // Generate UUID token server-side
    const token = uuidv4();

    // Store token in DB with expiration (e.g., 30 min)
    await pool.query(
      "INSERT INTO recovery_tokens (token, email, org_id, auth_id, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes')",
      [token, email, orgId, authenticatorId]
    );

    // Send Telegram message with token in link
    const confirmLink = `https://yourapp.com/confirm-policy?token=${token}`;
    const message = `Recovery complete! Your new passkey is ready. Click here to confirm and enable full access (login/sessions): ${confirmLink}\nIf this wasn't you, ignore and contact support.`;
    await bot.telegram.sendMessage(telegramId, message);

    res.json({ success: true });
  } catch (e) {
    console.error(`Notify recovery failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

router.get('/confirm-policy', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('<h2>Error: Missing token</h2>');

  try {
    const tokenRes = await pool.query(
      "SELECT org_id, auth_id FROM recovery_tokens WHERE token = $1 AND expires_at > NOW() AND used = FALSE",
      [token]
    );
    if (tokenRes.rows.length === 0) return res.status(401).send('<h2>Error: Invalid or expired token</h2>');

    const { org_id, auth_id } = tokenRes.rows[0];

    // Mark as used to prevent reuse
    await pool.query("UPDATE recovery_tokens SET used = TRUE WHERE token = $1", [token]);

    res.render('confirm-policy', { org_id, auth_id });
  } catch (e) {
    console.error(`Confirm policy failed: ${e.message}`);
    res.status(500).send('<h2>Error: Server error</h2>');
  }
});

// Endpoint to proxy transaction requests to the bot API
router.post('/bot-transaction', async (req, res) => {
  const { orgId, transactionType, ...transactionParams } = req.body;
  
  if (!orgId || !transactionType) {
    return res.status(400).json({ error: "Missing orgId or transactionType" });
  }

  try {
    // Get user's telegram_id from orgId
    const userRes = await pool.query(
      "SELECT u.telegram_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_sub_org_id = $1",
      [orgId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    
    const telegramId = userRes.rows[0].telegram_id;

    // Forward request to Python bot API on port 8080
    const botApiUrl = `http://localhost:8080/api/${transactionType}`;
    const botResponse = await fetch(botApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: telegramId,
        org_id: orgId,
        ...transactionParams
      })
    });

    if (!botResponse.ok) {
      const errorData = await botResponse.text();
      throw new Error(`Bot API error: ${errorData}`);
    }

    const botData = await botResponse.json();
    res.json(botData);

  } catch (e) {
    console.error(`Bot transaction proxy failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
