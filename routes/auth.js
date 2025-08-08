// routes/auth.js - Backend for Turnkey registration and pioneer management
const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');

// Check if user can become a pioneer (founder)
async function checkPioneerEligibility(telegramId) {
  try {
    // Check if user was referred (referees cannot become pioneers)
    const referralCheck = await pool.query(
      "SELECT 1 FROM referrals WHERE referee_id = $1",
      [telegramId]
    );
    
    if (referralCheck.rows.length > 0) {
      return { eligible: false, reason: "Users who were referred cannot become pioneers." };
    }

    // Check current pioneer count
    const pioneerCount = await pool.query("SELECT COUNT(*) FROM founders");
    const currentCount = parseInt(pioneerCount.rows[0].count);
    
    if (currentCount >= 25) {
      return { eligible: false, reason: "Sorry, the pioneer program is full! Only 25 slots are available." };
    }

    return { eligible: true, currentCount };
  } catch (error) {
    console.error('Error checking pioneer eligibility:', error);
    return { eligible: false, reason: "Error checking pioneer eligibility." };
  }
}

// Add user as pioneer (founder)
async function addPioneer(telegramId) {
  try {
    const eligibility = await checkPioneerEligibility(telegramId);
    
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    // Insert into founders table
    await pool.query(
      "INSERT INTO founders (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING",
      [telegramId]
    );

    return { success: true, message: "Successfully registered as pioneer!" };
  } catch (error) {
    console.error('Error adding pioneer:', error);
    throw error;
  }
}

// Check pioneer eligibility endpoint
router.get('/check-pioneer-eligibility', async (req, res) => {
  const { telegramId } = req.query;
  
  if (!telegramId) {
    return res.status(400).json({ error: "Missing telegramId" });
  }

  try {
    const eligibility = await checkPioneerEligibility(telegramId);
    res.json(eligibility);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Register user as pioneer endpoint
router.post('/register-pioneer', async (req, res) => {
  const { telegramId } = req.body;
  
  if (!telegramId) {
    return res.status(400).json({ error: "Missing telegramId" });
  }

  try {
    const result = await addPioneer(telegramId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Handle Turnkey registration with pioneer status check
async function handleTurnkeyPost(telegram_id, referrer_id, email, apiPublicKey) {
  // ADDED: Check for legacy user first
  const legacyCheck = await pool.query(
    "SELECT source_old_db, encrypted_s_address_secret, pioneer_status FROM users WHERE telegram_id = $1",
    [telegram_id]
  );
  
  const isLegacy = legacyCheck.rows.length > 0 && 
                   legacyCheck.rows[0].source_old_db && 
                   legacyCheck.rows[0].encrypted_s_address_secret;
  
  if (isLegacy) {
    // Handle legacy user migration
    const legacyUser = legacyCheck.rows[0];
    
    // Create new wallet for legacy user
    const { subOrgId, keyId, publicKey, rootUserId } = await createTurnkeySubOrg(telegram_id, email, apiPublicKey);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update existing user record with new wallet info
      await client.query(
        "UPDATE users SET user_email = $1, turnkey_user_id = $2, migration_notified = TRUE WHERE telegram_id = $3",
        [email, rootUserId, telegram_id]
      );
      
      // Insert new wallet
      await client.query(
        "INSERT INTO turnkey_wallets (telegram_id, turnkey_sub_org_id, turnkey_key_id, public_key, is_active) " +
        "VALUES ($1, $2, $3, $4, TRUE)",
        [telegram_id, subOrgId, keyId, publicKey]
      );
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    return { 
      subOrgId, 
      email,
      isLegacy: true,
      pioneerStatus: legacyUser.pioneer_status
    };
  }

  const existing = await pool.query(
    "SELECT turnkey_sub_org_id, turnkey_key_id, public_key FROM turnkey_wallets WHERE telegram_id = $1 AND is_active = TRUE",
    [telegram_id]
  );
  if (existing.rows.length > 0) {
    console.log(`Existing sub-org found for ${telegram_id}`);
    return { subOrgId: existing.rows[0].turnkey_sub_org_id, email };
  }

  // Check pioneer eligibility before creating new wallet
  const eligibility = await checkPioneerEligibility(telegram_id);
  if (eligibility.eligible) {
    console.log(`User ${telegram_id} is eligible for pioneer status`);
    // Note: Pioneer status will be added after successful wallet creation
  } else {
    console.log(`User ${telegram_id} is not eligible for pioneer status: ${eligibility.reason}`);
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

module.exports = router;
