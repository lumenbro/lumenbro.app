const express = require('express');
const router = express.Router();

// In-memory temp storage with TTL for generated backups
const tempStore = new Map();
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of tempStore.entries()) {
    if (entry.expiresAt <= now) tempStore.delete(id);
  }
}
setInterval(cleanup, 60 * 1000).unref();

function makeId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// POST /api/temp-backup { filename, mime, base64 }
router.post('/api/temp-backup', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { filename, mime, base64 } = req.body || {};
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'Missing base64 content' });
    }
    const id = makeId();
    tempStore.set(id, {
      buffer: Buffer.from(base64, 'base64'),
      filename: filename || `lumenbro-backup-${Date.now()}.lbk`,
      mime: mime || 'application/octet-stream',
      expiresAt: Date.now() + TTL_MS
    });
    const url = `/api/temp-backup/${id}`;
    return res.json({ success: true, id, url });
  } catch (e) {
    console.error('temp-backup upload failed:', e.message);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/temp-backup/:id → download attachment
router.get('/api/temp-backup/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = tempStore.get(id);
    if (!entry) return res.status(404).send('Not found');
    res.setHeader('Content-Type', entry.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${entry.filename.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(entry.buffer);
  } catch (e) {
    console.error('temp-backup download failed:', e.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;


