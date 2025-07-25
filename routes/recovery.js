const express = require('express');
const router = express.Router();
const turnkeyRequest = require('../turnkeyClient');
const pool = require('../db');

router.get('/recovery', (req, res) => {
  const email = req.query.email || 'unknown@lumenbro.com';
  const orgId = req.query.orgId;
  if (!orgId) return res.status(400).json({ error: "Missing orgId" });
  res.render('recovery', { email, org_id: orgId });
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
      organizationId: orgId,
      email,
      targetPublicKey,
      expirationSeconds: "3600",
      emailCustomization: { appName: "LumenBro" }
    };
    console.log('Init request data:', data);
    const response = await turnkeyRequest('INIT_USER_EMAIL_RECOVERY', data);
    const fetchedUserId = response.activity?.result?.initUserEmailRecoveryResult?.userId;
    if (fetchedUserId && fetchedUserId !== userId) {
      await pool.query("UPDATE users SET turnkey_user_id = $1 WHERE user_email = $2", [fetchedUserId, email]);
    }
    res.json({ success: true, userId: fetchedUserId || userId });
  } catch (e) {
    console.error(`Init recovery failed: ${e.message}\n${e.stack}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
