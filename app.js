require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const app = express();
const port = 3000;

// Create HTTP server for WebSocket
const server = http.createServer(app);

// CORS configuration for Telegram Mini App
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow your domain and Telegram WebApp origins
    const allowedOrigins = [
      'https://web.telegram.org',
      'https://t.me',
      'https://telegram.org',
      'https://lumenbro.app',
      'https://www.lumenbro.app',
      'https://lumenbro.com',
      'https://www.lumenbro.com',
      'http://localhost:3000',
      'http://localhost:8080'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Temporarily allow all for testing
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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
const exportRoutes = require('./routes/export');
const walletRoutes = require('./routes/wallet');
const signTransactionRoutes = require('./routes/sign-transaction');
const turnkeyHelperRoutes = require('./routes/turnkey-helper');

// Add cache-busting for development (exclude asset metadata endpoints)
if (process.env.NODE_ENV !== 'production') {
  app.use('/mini-app', (req, res, next) => {
    // Skip cache-busting for asset metadata endpoints to allow caching
    if (req.path.includes('/asset-metadata/') || req.path.includes('/toml-metadata/')) {
      return next();
    }
    
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
}

// Public branding toggles (legal compliance)
app.locals.ALLOW_TURNKEY_BRAND = process.env.ALLOW_TURNKEY_BRAND === 'true';
app.locals.walletProviderName = app.locals.ALLOW_TURNKEY_BRAND ? 'Turnkey' : '';
app.locals.walletProviderDescriptor = app.locals.ALLOW_TURNKEY_BRAND ? 'Turnkey embedded wallets' : 'embedded wallets';

app.use(authRoutes);
app.use(loginRoutes);
app.use(recoveryRoutes);
app.use('/api/charts', chartsRoutes);
app.use(exportRoutes);
app.use('/api', walletRoutes);
app.use(signTransactionRoutes);
app.use(turnkeyHelperRoutes);
// Download routes removed per mobile constraints

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
const host = '0.0.0.0'; // Always bind to all interfaces for EC2 communication
server.listen(port, host, () => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🚀 Development mode - Network access enabled`);
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log(`Local access: http://localhost:${port}`);
    console.log(`Network access: http://192.168.1.247:${port}`);
  } else {
    console.log(`🔒 Production mode - All interfaces enabled for EC2 communication`);
    console.log(`Server running on http://0.0.0.0:${port}`);
  }
  
  // Start sync service (DISABLED for modularization testing)
  // if (process.env.NODE_ENV === 'production') {
  //   syncService.start();
  //   console.log('Sync service started');
  // }
  console.log('📊 Chart sync service disabled for modularization testing');
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
