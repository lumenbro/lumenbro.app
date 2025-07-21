require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./routes/auth');
const loginRoutes = require('./routes/login');
const recoveryRoutes = require('./routes/recovery');
app.use(authRoutes);
app.use(loginRoutes);
app.use(recoveryRoutes);

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

app.listen(port, () => console.log(`Server running on port ${port}`));
