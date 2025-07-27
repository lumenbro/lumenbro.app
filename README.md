# LumenBro App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

LumenBro is a Telegram bot (@lumenbrobot) and companion web app for seamless trading on the Stellar network. It enables users to buy/sell assets, copy trade wallets, manage withdrawals, earn referrals, and handle wallet authentication securely using Turnkey's embedded wallets with passkeys. The system integrates Telegram Mini Apps for client-side key storage via Turnkey's Telegram Cloud Storage Stamper, ensuring gated access tied to Telegram accounts. The bot (Python) runs on one EC2 instance for automation (e.g., copy trading), while the web backend (Node.js/Express) on another handles user auth, sessions, and recovery, sharing a common RDS database.

Key goals: Non-custodial wallets, automated trading without per-action auth, and secure key persistence in Telegram Cloud for mobile-first users.

## Features

- **Telegram Bot (@lumenbrobot)**:
  - Buy/Sell assets on Stellar (SDEX/Soroban fallback).
  - Copy trading: Stream and replicate trades from watched wallets with multipliers/slippage.
  - Balance checks, withdrawals, trustline management.
  - Referrals: Earn rewards with discounts for referred users.
  - Pioneer program (limited to 25 users).
  - Commands: /start, /register, /balance, /unregister, etc.

- **Web App (lumenbro.com)**:
  - /turnkey-auth: Register sub-org, setup passkey.
  - /login: Start sessions, store temp keys.
  - /recovery: Email-based recovery with policy updates.
  - Mini App integration: /mini-app for Telegram-gated flows (auth/login/recovery), using stamper for API key storage in Cloud Storage.

- **Security & Automation**:
  - Turnkey sub-orgs per user for isolated wallets.
  - Sessions (up to 1 year) for bot-automated signing (e.g., copy trades without user clicks).
  - Hybrid key storage: Client-side in Telegram Cloud, synced to DB for server access.
  - Validation: initData HMAC for Mini App requests.

- **Backend**:
  - Node.js/Express: Handles Turnkey API calls, JWT for legacy auth, DB interactions.
  - Python Bot: Aiogram for Telegram handling, Stellar SDK for transactions.

## Tech Stack

- **Backend (Node.js)**: Express, JWT, PG (for RDS), Turnkey SDK, Webpack for bundling.
- **Bot (Python)**: Aiogram, AsyncPG, Stellar SDK, Turnkey HTTP client, Sessions for HPKE decryption.
- **Database**: PostgreSQL (RDS) with tables for users, wallets, referrals, trades, etc.
- **Frontend/Mini App**: HTML/JS/CSS, Telegram WebApp API, Turnkey browser SDK (bundled as turnkey.min.js).
- **Deployment**: EC2 (separate for bot/web), PM2 for process management, HTTPS via Let's Encrypt.
- **Tools**: Turnkey for wallets/passkeys/sessions, Telegram Cloud Storage for stamper-based key persistence.

## Installation & Setup

### Prerequisites
- Node.js (v18+), npm.
- Python 3.12+.
- PostgreSQL RDS instance (configure .env with DB creds).
- Turnkey API keys (TURNKEY_ORG_ID, etc.) in .env.
- Telegram Bot Token (TELEGRAM_BOT_TOKEN) from @BotFather.
- JWT_SECRET for auth.

### Node.js Backend (Web/Mini App)
1. Clone repo: `git clone https://github.com/lumenbro/lumenbro.app`
2. Navigate: `cd lumenbro.app`
3. Install deps: `npm install`
4. Build bundle: `npm run build-turnkey` (for turnkey.min.js with stamper).
5. Configure .env (DB_HOST, TURNKEY keys, etc.).
6. Run: `pm2 start ecosystem.config.js` (or `node app.js` for dev).

### Python Bot
1. Clone/setup bot repo (separate; integrate as needed).
2. Install deps: `pip install -r requirements.txt` (aiogram, asyncpg, stellar-sdk, etc.).
3. Configure .env (same DB creds, TELEGRAM_TOKEN).
4. Run: `python main.py`

### Database
- Run migrations (from bot's init_db_pool in main.py) to create tables.

### Mini App
- In @BotFather: Set Mini App URL to https://lumenbro.com/mini-app/index.html.
- Test: Bot sends buttons to open /mini-app?mode=auth (pre-fills telegram_id).

## Usage

1. **Registration**:
   - Bot: /register → Opens Mini App for sub-org creation/passkey setup.
   - Keys stored in Telegram Cloud via stamper.

2. **Login/Session**:
   - Bot: /login → Mini App creates session, syncs temp keys to DB.

3. **Trading**:
   - Bot commands for buy/sell/copy; uses DB sessions for automated signing.

4. **Recovery**:
   - Bot: Sends Mini App link for email/passkey recovery.

## Testing

- **Local**: Use ngrok for HTTPS tunneling (e.g., ngrok http 3000), set in @BotFather.
- **Direct Mini App**: https://lumenbro.com/mini-app/index.html?mode=auth (partial; no Cloud Storage).
- **Full**: Telegram app → Bot button → WebView; check DB for sub-org/keys.
- **Debug**: Console logs in Mini App JS; PM2 logs for backend.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Pull requests welcome! Focus on security (e.g., initData validation) and Stellar integrations.

For issues: Open GitHub issue with logs/errors.
