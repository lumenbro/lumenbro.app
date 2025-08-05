require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const port = 3000;

// Create HTTP server for WebSocket
const server = http.createServer(app);

app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize WebSocket service
const WebSocketService = require('./services/websocketService');
const wsService = new WebSocketService(server);

// Initialize sync service
const syncService = require('./services/syncService');

// Routes
const authRoutes = require('./routes/auth');
const loginRoutes = require('./routes/login');
const recoveryRoutes = require('./routes/recovery');
const chartsRoutes = require('./routes/charts');

app.use(authRoutes);
app.use(loginRoutes);
app.use(recoveryRoutes);
app.use('/api/charts', chartsRoutes);

// Landing
app.get('/', (req, res) => {
  res.render('landing');
});

// Optional callback from app.py (if needed)
app.post('/turnkey-callback', async (req, res) => {
  const { telegram_id, sub_org_id, key_id, public_key } = req.body;
  const pool = require('./db');
  const axios = require('axios');
  try {
    await pool.query(
      "UPDATE turnkey_wallets SET turnkey_sub_org_id=$1, turnkey_key_id=$2, public_key=$3 WHERE telegram_id = $4",
      [sub_org_id, key_id, public_key, telegram_id]
    );
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: telegram_id,
      text: "Passkey setup complete! Use /start in the bot."
    });
    res.status(200).json({ status: "success" });
  } catch (e) {
    console.error(`Callback failed: ${e.message}`);
    res.status(400).json({ error: e.message });
  }
});

// API status endpoint
app.get('/api/status', (req, res) => {
  const wsStats = wsService.getStats();
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    services: {
      websocket: {
        totalClients: wsStats.totalClients,
        totalSubscriptions: wsStats.totalSubscriptions
      }
    }
  });
});

// WebSocket stats endpoint
app.get('/api/websocket/stats', (req, res) => {
  const stats = wsService.getStats();
  res.json({
    success: true,
    stats
  });
});

app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  
  // Start sync service
  if (process.env.NODE_ENV === 'production') {
    syncService.start();
    console.log('Sync service started');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wsService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  wsService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
