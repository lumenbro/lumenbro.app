// routes/turnkey-helper.js - Minimal helpers for Turnkey flows
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Use Turnkey crypto on the server (already present in login route)
const { decryptCredentialBundle } = require('@turnkey/crypto');

// Fetch BOT_TOKEN from env for Telegram initData validation
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function validateInitData(initData) {
	try {
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
	} catch (e) {
		return false;
	}
}

// POST /mini-app/decrypt-credential-bundle
// Body: { credentialBundle: string, ephemeralPrivateKey: hex string, initData: string }
// Returns: { privateKeyHex }
router.post('/mini-app/decrypt-credential-bundle', async (req, res) => {
	try {
		const { credentialBundle, ephemeralPrivateKey, initData } = req.body || {};
		if (!credentialBundle || !ephemeralPrivateKey || !initData) {
			return res.status(400).json({ error: 'Missing credentialBundle, ephemeralPrivateKey, or initData' });
		}
		if (!validateInitData(initData)) {
			return res.status(403).json({ error: 'Invalid initData' });
		}

		// Decrypt using Turnkey crypto
		const privateKeyHex = decryptCredentialBundle(credentialBundle, ephemeralPrivateKey);
		if (!privateKeyHex || typeof privateKeyHex !== 'string') {
			return res.status(500).json({ error: 'Decryption returned invalid data' });
		}
		return res.json({ privateKeyHex });
	} catch (e) {
		console.error('decrypt-credential-bundle failed:', e.message);
		return res.status(500).json({ error: e.message });
	}
});

module.exports = router;
 
// POST /mini-app/derive-p256-public
// Body: { privateKeyHex: string, initData: string }
// Returns: { publicKeyHex }
router.post('/mini-app/derive-p256-public', async (req, res) => {
	try {
		const { privateKeyHex, initData } = req.body || {};
		if (!privateKeyHex || !initData) {
			return res.status(400).json({ error: 'Missing privateKeyHex or initData' });
		}
		if (!validateInitData(initData)) {
			return res.status(403).json({ error: 'Invalid initData' });
		}
		// Derive compressed P-256 public key
		const buf = Buffer.from(privateKeyHex, 'hex');
		const ecdh = crypto.createECDH('prime256v1');
		ecdh.setPrivateKey(buf);
		const publicKeyHex = ecdh.getPublicKey('hex', 'compressed');
		return res.json({ publicKeyHex });
	} catch (e) {
		console.error('derive-p256-public failed:', e.message);
		return res.status(500).json({ error: e.message });
	}
});


