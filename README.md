# LumenBro App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

LumenBro is a **secure, non-custodial** Telegram bot (@lumenbrobot) and companion web app for seamless trading on the Stellar network. The system features **end-to-end encryption**, **multi-layered security architecture**, and **automated trading capabilities** while maintaining user control over their private keys.

### Architecture
- **Python Bot**: Handles Telegram interactions, automated trading, and Stellar transactions
- **Node.js Web Backend**: Manages user authentication, sessions, and Mini App functionality
- **Shared Database**: Coordinates between bot and web backend
- **Telegram Mini Apps**: Secure client-side key management with encrypted storage

### Key Security Features
- 🔐 **Non-custodial wallets** via Turnkey's embedded wallet infrastructure
- 🔑 **Client-side key encryption** with AES-256-GCM and PBKDF2
- ☁️ **Telegram Cloud Storage** for persistent, encrypted key storage
- 🔒 **KMS integration** for session key encryption (AWS KMS)
- 🛡️ **Multi-device compatibility** with secure mobile/desktop flows
- 🔄 **Automated session management** for trading without per-action authentication
- 📱 **Mobile-first design** with enhanced security for Telegram WebView

## Security Architecture

### 1. Key Storage & Encryption
```
User Password → PBKDF2 (100,000 iterations) → AES-256-GCM → Telegram Cloud Storage
```
- **Client-side encryption**: All private keys encrypted before storage
- **Password-based derivation**: PBKDF2 with high iteration count
- **Persistent storage**: Encrypted keys stored in Telegram Cloud Storage
- **Cross-device sync**: Keys follow user across devices securely

### 2. Session Management
```
Session Creation → HPKE Encryption → KMS Storage → Database
```
- **HPKE (Hybrid Public Key Encryption)**: Secure session key exchange
- **AWS KMS integration**: Server-side session key encryption
- **Temporary API keys**: Short-lived credentials for automated trading
- **Automatic expiration**: Sessions expire after 90 days

### 3. Mobile Security Enhancements
- **Backend signing**: Mobile devices can use server-side ECDSA (P‑256) when Web Crypto is constrained
- **Sub‑org enforcement**: All signatures originate from the user’s sub‑organization
- **HPKE handling**: Recovery decrypts credential bundles server-side to avoid WebView limitations
- **Minimal logging**: Sensitive values (keys, stamps, bundles) are redacted in logs

### 4. Integration Security
- **initData validation**: HMAC verification for all Mini App requests
- **Database consistency**: Coordinated schema between Python bot and Node.js backend
- **Legacy user protection**: Safety checks prevent accidental data loss
- **Automated clearing**: Secure data deletion with confirmation dialogs

## Python Bot Integration

### Shared Database Schema
The Node.js backend and Python bot share the same PostgreSQL database with coordinated schema:

```sql
-- Users table (shared between bot and web)
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    public_key TEXT,
    referral_code TEXT,
    turnkey_user_id TEXT,
    turnkey_session_id TEXT,
    temp_api_public_key TEXT,
    temp_api_private_key TEXT,
    session_expiry TIMESTAMP,
    kms_encrypted_session_key TEXT,
    kms_key_id TEXT,
    user_email TEXT,
    session_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_old_db TEXT,
    encrypted_s_address_secret TEXT,
    migration_date TIMESTAMP,
    pioneer_status BOOLEAN DEFAULT FALSE,
    migration_notified BOOLEAN DEFAULT FALSE,
    migration_notified_at TIMESTAMP,
    legacy_public_key TEXT
);

-- Turnkey wallets table (shared)
CREATE TABLE turnkey_wallets (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    turnkey_sub_org_id TEXT NOT NULL,
    turnkey_key_id TEXT NOT NULL,
    public_key TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_id, turnkey_key_id)
);
```

### Workflow Integration
1. **Registration**: Node.js creates Turnkey sub-org, Python bot validates
2. **Session Creation**: Node.js creates encrypted sessions, Python bot decrypts for trading
3. **Trading**: Python bot uses decrypted session keys for automated transactions
4. **Recovery**: Node.js handles email verification, Python bot updates user state

### KMS Coordination
- **Shared KMS configuration**: Both services use the same AWS KMS key for session encryption
- **Node.js**: Encrypts session keys before database storage
- **Python**: Decrypts session keys for trading operations

## Features

### Telegram Bot (@lumenbrobot)
- **Secure Trading**: Buy/sell assets on Stellar (SDEX/Soroban fallback)
- **Copy Trading**: Stream and replicate trades from watched wallets
- **Balance Management**: Real-time balance checks and withdrawals
- **Trustline Management**: Automated asset trustline setup
- **Referral System**: Earn rewards with secure referral tracking
- **Pioneer Program**: Limited access for early adopters

### Web App (lumenbro.com)
- **Secure Registration**: `/turnkey-auth` for sub-org creation and passkey setup
- **Session Management**: `/login` for secure session creation
- **Account Recovery**: `/recovery` with email-based verification
- **Mini App Integration**: Telegram-gated flows with encrypted storage

### Chart Data API
- **Real-time Data**: WebSocket streaming for live market updates
- **Batch Processing**: Efficient multi-asset data retrieval
- **Caching**: Redis-based performance optimization
- **Background Sync**: Automated data collection and updates

## Recent Improvements & Changelog

### v2.1.0 (Current) - Mobile Security & Export
- ✅ **Mobile Login**: DER/low‑s P‑256 signing with sub‑org enforcement
- ✅ **Recovery**: Server‑side OTP verify + decrypt; create API keys with sub‑org session key
- ✅ **Wallet Export**: HPKE with uncompressed target key; Stellar StrKey conversion
- ✅ **Data Hygiene**: Sensitive logs redacted; client storage auto‑clearing
- ✅ **Compatibility**: Robust fallbacks for Telegram WebView

### v2.0.0 - Security Overhaul
- ✅ **Client-side Encryption**: AES-256-GCM with PBKDF2 key derivation
- ✅ **KMS Integration**: AWS KMS for session key encryption
- ✅ **Legacy Migration**: Safe migration from unencrypted to encrypted keys
- ✅ **Mobile Support**: Enhanced mobile compatibility with fallback mechanisms
- ✅ **Database Coordination**: Synchronized schema between Python bot and Node.js

### v1.5.0 - Mini App & Recovery
- ✅ **Telegram Mini Apps**: Secure client-side key management
- ✅ **Cloud Storage**: Persistent encrypted key storage
- ✅ **Email Recovery**: Secure account recovery with verification
- ✅ **Session Management**: Automated trading session creation

### v1.0.0 - Core Features
- ✅ **Turnkey Integration**: Non-custodial wallet infrastructure
- ✅ **Automated Trading**: Copy trading and automated transactions
- ✅ **Stellar Integration**: SDEX and Soroban trading support
- ✅ **Referral System**: Secure referral tracking and rewards

## Tech Stack

### Backend Services
- **Node.js/Express**: Web backend, Mini App API, session management
- **Python/Aiogram**: Telegram bot, automated trading, Stellar transactions
- **PostgreSQL**: Shared database with coordinated schema
- **Redis**: Caching and real-time data management
- **AWS KMS**: Session key encryption and management

### Security Libraries
- **secp256k1**: Server-side ECDSA signing for mobile compatibility
- **crypto-js**: Client-side encryption utilities
- **Turnkey SDK**: Non-custodial wallet infrastructure
- **Web Crypto API**: Browser-based cryptographic operations

### Frontend
- **Telegram Mini Apps**: Secure client-side interface
- **WebSocket**: Real-time data streaming
- **Webpack**: Bundled Turnkey SDK for browser compatibility

## Installation & Setup

### Prerequisites
- Node.js (v18+), npm
- Python 3.12+
- PostgreSQL database
- AWS KMS access
- Turnkey API credentials
- Telegram Bot Token

### Environment Variables
```bash
# Database
DB_HOST=<your-rds-endpoint>
DB_PORT=5434
DB_NAME=postgres
DB_USER=<database-user>
DB_PASSWORD=<database-password>

# AWS
AWS_REGION=<your-aws-region>
KMS_KEY_ID=<your-kms-key-id>

# Telegram
TELEGRAM_BOT_TOKEN=<your-bot-token>

# Turnkey
TURNKEY_API_PUBLIC_KEY=<your-public-key>
TURNKEY_API_PRIVATE_KEY=<your-private-key>
TURNKEY_ORGANIZATION_ID=<your-org-id>
```

### Deployment
1. **Node.js Backend**:
   ```bash
   npm install
   npm run build-turnkey
   pm2 start ecosystem.config.js
   ```

2. **Python Bot**:
   ```bash
   pip install -r requirements.txt
   python main.py
   ```

3. **Database Migration**:
   ```bash
   # Run schema.sql on your database instance
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/schema.sql
   ```

## Security Best Practices

### For Developers
- **Never commit sensitive data**: Use environment variables for all secrets
- **Validate all inputs**: Implement proper input validation and sanitization
- **Use HTTPS only**: All communications must be encrypted
- **Regular security audits**: Review code for potential vulnerabilities
- **Monitor logs**: Track security events and suspicious activities

### For Users
- **Strong passwords**: Use unique, complex passwords for encryption
- **Secure devices**: Ensure devices are protected with biometrics/passcodes
- **Regular backups**: Export and securely store wallet keys
- **Monitor activity**: Regularly check trading activity and balances
- **Report issues**: Immediately report any suspicious activity

## API Documentation

### Chart Data API Endpoints

Base URL: `https://lumenbro.com/api/charts`

#### Health Check
```bash
GET /health
```

#### Single Chart Data
```bash
GET /single?baseAsset=XLM&counterAsset=USDC&resolution=1h&hours=24
```

#### Batch Chart Data
```bash
POST /batch
Content-Type: application/json

{
  "pairs": [
    {
      "baseAsset": "XLM",
      "counterAsset": "USDC",
      "resolution": "1h",
      "hours": 24
    }
  ]
}
```

#### WebSocket Streaming
```bash
wss://lumenbro.com/api/charts/stream
```

## Testing

### Security Testing
- **Encryption validation**: Verify client-side encryption/decryption
- **Session testing**: Test session creation and expiration
- **Mobile compatibility**: Test on various mobile devices and browsers
- **Recovery flows**: Test account recovery and key export
- **Integration testing**: Verify Python bot and Node.js coordination

### Local Development
```bash
# Use ngrok for HTTPS tunneling
ngrok http 3000

# Test Mini App
https://lumenbro.com/mini-app/index.html?mode=auth
```

## License

MIT License. See [LICENSE](LICENSE) for details.

## Contributing

We welcome contributions focused on:
- **Security improvements**: Encryption, authentication, validation
- **Stellar integrations**: New trading features and asset support
- **Mobile compatibility**: Enhanced mobile user experience
- **Performance optimization**: Database queries, caching, API efficiency

### Security Reporting
For security issues, please contact us directly rather than opening public issues.

---

**⚠️ Security Notice**: This application handles financial transactions and private keys. Always verify the source and review security measures before use.
