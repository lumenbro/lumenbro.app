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
    console.log('🔍 Looking up org for email:', email.trim());
    
    const userRes = await pool.query(
      "SELECT tw.turnkey_sub_org_id, u.user_email FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE LOWER(u.user_email) = LOWER($1) AND tw.is_active = TRUE",
      [email.trim()]
    );
    
    if (userRes.rows.length === 0) {
      console.log('❌ No wallet found for email:', email.trim());
      // Let's also check what emails exist in the database
      const allEmails = await pool.query("SELECT DISTINCT user_email FROM users WHERE user_email IS NOT NULL");
      console.log('📧 Available emails in database:', allEmails.rows.map(row => row.user_email));
      return res.status(404).json({ error: "No active wallet found for this email address" });
    }
    
    const orgId = userRes.rows[0].turnkey_sub_org_id;
    const storedEmail = userRes.rows[0].user_email;
    console.log('✅ Found wallet for email:', email.trim(), 'stored as:', storedEmail, 'orgId:', orgId);
    res.json({ orgId, email: storedEmail });
    
  } catch (e) {
    console.error(`Lookup org by email failed: ${e.message}`);
    res.status(500).json({ error: "Database error" });
  }
});

// Step 1: Initialize OTP (modern approach)
router.post('/init-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }
  
  try {
    // Find the user's sub-org by email (case-insensitive)
    const userRes = await pool.query(
      "SELECT tw.turnkey_sub_org_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE LOWER(u.user_email) = LOWER($1) AND tw.is_active = TRUE",
      [email.trim()]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "No wallet found for this email address" });
    }
    
    const orgId = userRes.rows[0].turnkey_sub_org_id;
    
    // Modern OTP initialization (direct SDK call)
    const { Turnkey } = require('@turnkey/sdk-server');
    const turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
      defaultOrganizationId: process.env.TURNKEY_ORG_ID
    });
    const client = turnkey.apiClient();

    console.log('Initiating OTP for:', {
      email: email.trim().toLowerCase(),
      orgId: orgId
    });
    
    const response = await client.initOtpAuth({
      organizationId: orgId, // User's sub-org
      otpType: "OTP_TYPE_EMAIL",
      contact: email.trim().toLowerCase(),
      otpLength: 6,
      emailCustomization: {
        appName: "LumenBro",
        emailSubject: "LumenBro Wallet Recovery Code",
        emailBody: "Your LumenBro recovery code is: {{OTP}}\n\nThis code expires in 5 minutes."
      }
    });
    console.log('OTP initiated successfully:', response);
    
    res.json({ 
      success: true, 
      message: "Recovery code sent to your email!",
      otpId: response.otpId, // OTP ID is at top level
      orgId: orgId
    });
    
  } catch (error) {
    console.error(`OTP initiation failed: ${error.message}`);
    res.status(500).json({ 
      error: "Failed to send recovery code",
      details: error.message 
    });
  }
});

// Step 2: Verify OTP and get session
router.post('/verify-otp', async (req, res) => {
  const { otpId, otpCode, targetPublicKey, email } = req.body;
  
  if (!otpId || !otpCode || !targetPublicKey || !email) {
    return res.status(400).json({ error: "Missing required fields: otpId, otpCode, targetPublicKey, email" });
  }
  
  try {
    // Find the user's sub-org by email (case-insensitive)
    const userRes = await pool.query(
      "SELECT tw.turnkey_sub_org_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE LOWER(u.user_email) = LOWER($1) AND tw.is_active = TRUE",
      [email.trim()]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "No wallet found for this email address" });
    }
    
    const orgId = userRes.rows[0].turnkey_sub_org_id;
    
    // Use direct SDK call for OTP verification
    const { Turnkey } = require('@turnkey/sdk-server');
    const turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
      defaultOrganizationId: process.env.TURNKEY_ORG_ID
    });
    const client = turnkey.apiClient();

    console.log('Verifying OTP:', {
      otpId: otpId,
      orgId: orgId,
      codeLength: otpCode.toString().length
    });
    
    const response = await client.otpAuth({
      organizationId: orgId,
      otpId: otpId,
      otpCode: otpCode.toString(),
      targetPublicKey: targetPublicKey,
      apiKeyName: `Recovery Session - ${email}`,
      expirationSeconds: "3600" // 1 hour session (string format)
    });
    console.log('OTP verified successfully:', response);
    
    // Return raw credentialBundle (string) to let client decrypt using Turnkey.decryptExportBundle
    const credentialBundle = response.activity?.result?.otpAuthResult?.credentialBundle;
    const userId = response.activity?.result?.otpAuthResult?.userId;
    const apiKeyId = response.activity?.result?.otpAuthResult?.apiKeyId;

    res.json({ 
      success: true, 
      message: "Recovery successful!",
      credentialBundle,
      userId,
      apiKeyId,
      orgId: orgId
    });
    
  } catch (error) {
    console.error(`OTP verification failed: ${error.message}`);
    res.status(500).json({ 
      error: "Invalid recovery code or code expired",
      details: error.message 
    });
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

// POST /create-recovery-api-key - Create new API key using root organization permissions
router.post('/create-recovery-api-key', async (req, res) => {
  const { email, orgId, publicKey, apiKeyName, userId: userIdFromClient } = req.body;
  
  if (!email || !orgId || !publicKey) {
    return res.status(400).json({ error: "Missing required fields: email, orgId, publicKey" });
  }
  
  try {
    console.log('🔑 Creating new API key for recovered user:', {
      email,
      orgId,
      apiKeyName: apiKeyName || `Recovery Telegram Key - ${email}`
    });
    
    // First, verify this is a legitimate recovery by checking the database
    const userRes = await pool.query(
      "SELECT u.telegram_id, u.turnkey_user_id FROM turnkey_wallets tw JOIN users u ON tw.telegram_id = u.telegram_id WHERE tw.turnkey_sub_org_id = $1 AND LOWER(u.user_email) = LOWER($2) AND tw.is_active = TRUE",
      [orgId, email.trim().toLowerCase()]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "No matching user found for this email and organization" });
    }
    
    let { telegram_id: telegramId, turnkey_user_id: userId } = userRes.rows[0];
    if (!userId && userIdFromClient) {
      console.log('ℹ️ Using userId from client recovery credentials');
      userId = userIdFromClient;
    }
    if (!userId) {
      return res.status(400).json({ error: "Missing userId for createApiKeys" });
    }
    
    // Use root organization credentials to create API key in user's sub-org
    const { Turnkey } = require('@turnkey/sdk-server');
    const turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
      defaultOrganizationId: process.env.TURNKEY_ORG_ID
    });
    const client = turnkey.apiClient();

    // Create new API key for the user
    const response = await client.createApiKeys({
      organizationId: orgId, // User's sub-org
      userId: userId,
      apiKeys: [{
        apiKeyName: apiKeyName || `Recovery Telegram Key - ${email}`,
        publicKey: publicKey,
        curveType: "API_KEY_CURVE_SECP256K1"
      }]
    });
    
    console.log('✅ Created new API key via root org:', response);
    
    const apiKeyId = response.activity?.result?.createApiKeysResult?.apiKeyIds?.[0];
    
    if (!apiKeyId) {
      throw new Error('Failed to get API key ID from response');
    }
    
    // Log the recovery action
    console.log(`🎉 Recovery API key created for user ${telegramId} (${email}): ${apiKeyId}`);
    
    res.json({ 
      success: true,
      apiKeyId: apiKeyId,
      message: "API key created successfully",
      orgId: orgId
    });
    
  } catch (error) {
    console.error('❌ Failed to create recovery API key:', error.message);
    res.status(500).json({ 
      error: "Failed to create new API key",
      details: error.message 
    });
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
