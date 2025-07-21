const express = require('express');
const router = express.Router();
const turnkeyClient = require('../turnkeyClient');
const crypto = require('crypto');

router.get('/recovery', (req, res) => {
  const email = req.query.email || 'unknown@lumenbro.com';
  const orgId = req.query.orgId;
  if (!orgId) return res.status(400).json({ error: "Missing orgId" });
  res.render('recovery', { email, org_id: orgId });
});

router.get('/init-recovery', async (req, res) => {
  const orgId = req.query.orgId;
  const email = req.query.email;
  if (!orgId || !email) return res.status(400).json({ error: "Missing orgId or email" });
  try {
    const ecdh = crypto.createECDH('secp256r1');
    ecdh.generateKeys();
    const targetPublicKey = ecdh.getPublicKey('hex', 'uncompressed');
    const response = await turnkeyClient.initUserEmailRecovery({
      organizationId: orgId,
      email,
      targetPublicKey,
      expirationSeconds: "3600",
      emailCustomization: { appName: "LumenBro" }
    });
    const userId = response.activity.result.initUserEmailRecoveryResult.userId;
    res.json({ success: true, userId });
  } catch (e) {
    console.error(`Init recovery failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

router.post('/inject-recovery', async (req, res) => {
  const { orgId, bundle, userId } = req.body;
  if (!orgId || !bundle || !userId) return res.status(400).json({ error: "Missing data" });
  try {
    const response = await turnkeyClient.completeUserEmailRecovery({
      organizationId: orgId,
      userId,
      credentialBundle: bundle
    });
    if (response.activity.status === 'ACTIVITY_STATUS_COMPLETED') {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: response.activity.failure });
    }
  } catch (e) {
    console.error(`Recovery completion failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
