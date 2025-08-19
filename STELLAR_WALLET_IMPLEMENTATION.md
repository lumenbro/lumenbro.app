# LumenBro Enhanced Stellar Wallet Implementation

## 🎯 Overview

This implementation creates a fully functional Stellar wallet based on xBull wallet architecture, optimized for Telegram WebView with client-side signing using Turnkey. The wallet supports multiple assets, path payments, swaps, and comprehensive transaction management.

## 🏗️ Architecture

### Core Components

1. **Stellar SDK Bundle** (`stellar.js`)
   - Local deployment for reliability in WebView environments
   - Client-side transaction building and signing
   - Path payment simulation and execution

2. **Enhanced Transaction Stamper** (`transaction-stamper.js`)
   - Multi-layered signing approach
   - Client-side Stellar SDK signing (preferred)
   - Turnkey TelegramCloudStorageStamper fallback
   - Server-side signing as final fallback

3. **Backend API** (`sign-transaction.js`)
   - User status checking and fee calculation
   - Transaction building with path payments
   - Enhanced signing with client-side support
   - Referral rewards and trade logging

## 🚀 Key Features

### 1. Client-Side Transaction Building
```javascript
// Uses Stellar SDK bundle for reliable client-side operations
const transactionBuilder = createStellarTransactionBuilder();
await transactionBuilder.initialize();

const result = await transactionBuilder.buildPaymentTransaction(
    sourcePublicKey,
    destination,
    amount,
    asset,
    memo
);
```

### 2. Multi-Layer Signing Strategy
```javascript
// 1. Client-side Stellar SDK signing (preferred)
// 2. Turnkey TelegramCloudStorageStamper (fallback)
// 3. Server-side signing (final fallback)
const stamper = createStellarTransactionStamper(privateKey, publicKey);
const stamp = await stamper.stamp(xdr);
```

### 3. Path Payment Swaps
```javascript
// Simulate path payment for asset swaps
const simulation = await transactionBuilder.simulatePathPayment(
    sourcePublicKey,
    sendAsset,
    sendAmount,
    destination,
    destAsset,
    destMin,
    path
);
```

### 4. User Status & Fee Management
```javascript
// Dynamic fee calculation based on user tier and volume
GET /mini-app/user-status/:telegram_id
{
  "user": {
    "tier": "pioneer|standard",
    "pioneer_status": true,
    "monthly_volume": 50000,
    "max_transaction_limit": 10000
  },
  "fees": {
    "networkFee": 0.00001,
    "serviceFee": 0.00001,
    "total": 0.00002,
    "multiplier": 0.5
  }
}
```

## 📱 Mobile-First Design

### Telegram WebView Optimization
- Local Stellar SDK bundle eliminates CDN dependencies
- Optimized for mobile performance and reliability
- Fallback mechanisms ensure functionality across devices

### User Experience
- Intuitive swap interface with real-time rate calculation
- Transaction confirmation with detailed fee breakdown
- Success screens with explorer links

## 🔐 Security Architecture

### Key Management
- **Client-side**: Encrypted keys in Telegram Cloud Storage
- **Backend**: KMS encrypted session keys
- **Signing**: Multiple layers with fallback support

### Transaction Security
- XDR validation on both client and server
- User status verification before transaction building
- Transaction limits based on user tier and volume

## 🛠️ Implementation Details

### 1. Stellar SDK Bundle (`stellar-entry.js`)
```javascript
// Bundles Stellar SDK with convenience methods
window.StellarSdk = {
  // Core classes
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  Networks,
  
  // Convenience methods
  createPaymentTransaction,
  createPathPaymentStrictSend,
  createPathPaymentStrictReceive,
  validateStellarAddress,
  getAccountInfo,
  estimateFee
};
```

### 2. Enhanced Transaction Stamper
```javascript
class StellarTransactionStamper {
  async stamp(payload) {
    // 1. Try client-side Stellar SDK signing
    // 2. Fallback to Turnkey stamper
    // 3. Final fallback to backend signing
  }
}
```

### 3. Transaction Builder
```javascript
class StellarTransactionBuilder {
  async buildPaymentTransaction(source, destination, amount, asset, memo)
  async buildPathPaymentTransaction(source, sendAsset, sendAmount, destination, destAsset, destMin, path)
  async simulatePathPayment(source, sendAsset, sendAmount, destination, destAsset, destMin, path)
}
```

## 🔄 Transaction Flow

### 1. Payment Flow
```
User Input → User Status Check → Transaction Building → Signing → Network Submission → Success
```

### 2. Swap Flow
```
User Input → Path Simulation → Rate Calculation → Transaction Building → Signing → Network Submission → Success
```

### 3. Signing Flow
```
XDR → Client-side Stellar SDK → Turnkey Stamper → Backend Signing → Signed XDR
```

## 📊 Database Schema

### Enhanced Tables
```sql
-- Users table with tier and volume tracking
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    pioneer_status BOOLEAN DEFAULT FALSE,
    session_expiry TIMESTAMP,
    turnkey_user_id TEXT,
    user_email TEXT
);

-- Trades table with enhanced logging
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    xlm_volume DECIMAL,
    tx_hash TEXT,
    turnkey_activity_id TEXT,
    fee_amount DECIMAL,
    fee_asset TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards table for referral system
CREATE TABLE rewards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    amount DECIMAL,
    status TEXT DEFAULT 'unpaid',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🎯 API Endpoints

### User Management
- `GET /mini-app/user-status/:telegram_id` - Check user status and fees
- `GET /mini-app/transaction-history/:telegram_id` - Get transaction history
- `GET /mini-app/user-rewards/:telegram_id` - Get user rewards

### Transaction Building
- `POST /mini-app/build-transaction` - Build transactions with path payments
- `POST /mini-app/simulate-path-payment` - Simulate path payments for swaps

### Transaction Signing
- `POST /mini-app/sign-transaction` - Enhanced signing with client-side support

## 🚀 Deployment

### 1. Build Bundles
```bash
npm run build-all  # Builds both Turnkey and Stellar SDK bundles
```

### 2. Environment Variables
```bash
# Database
DB_HOST=lumenbro-turnkey.cz2imkksk7b4.us-west-1.rds.amazonaws.com
DB_PORT=5434
DB_NAME=postgres
DB_USER=botadmin
DB_PASSWORD=<password>

# AWS KMS
AWS_REGION=us-west-1
KMS_KEY_ID=27958fe3-0f3f-44d4-b21d-9d820d5ad96c

# Telegram
TELEGRAM_BOT_TOKEN=<bot_token>

# Turnkey
TURNKEY_API_PUBLIC_KEY=<public_key>
TURNKEY_API_PRIVATE_KEY=<private_key>
TURNKEY_ORGANIZATION_ID=<org_id>
```

## 🔧 Configuration

### Fee Structure
- **Standard Users**: 100% base fees
- **Pioneer Users**: 50% discount
- **High Volume**: Additional 20% discount (>50,000 XLM/month)

### Transaction Limits
- **Standard Users**: 1,000 XLM max per transaction
- **Pioneer Users**: 10,000 XLM max per transaction
- **Daily Limits**: 10x max transaction
- **Monthly Limits**: 100x max transaction

## 🧪 Testing

### 1. Client-Side Testing
```javascript
// Test Stellar SDK bundle
console.log('Stellar SDK available:', typeof window.StellarSdk !== 'undefined');

// Test transaction builder
const builder = createStellarTransactionBuilder();
await builder.initialize();
```

### 2. Backend Testing
```bash
# Test user status
curl http://localhost:3000/mini-app/user-status/123456789

# Test transaction building
curl -X POST http://localhost:3000/mini-app/build-transaction \
  -H "Content-Type: application/json" \
  -d '{"sourcePublicKey":"G...","transactionData":{...}}'
```

## 🔄 Migration from Previous Version

### Breaking Changes
- Enhanced transaction stamper with new class names
- Updated API endpoints with additional parameters
- New database fields for user tier tracking

### Compatibility
- Legacy transaction stamper still available for backward compatibility
- Existing login/recovery flows unchanged
- Gradual migration to new signing methods

## 📈 Performance Optimization

### Client-Side Optimizations
- Local Stellar SDK bundle eliminates CDN loading
- Cached transaction building for repeated operations
- Optimized asset metadata fetching

### Backend Optimizations
- Database connection pooling
- Cached user status lookups
- Efficient referral reward calculations

## 🔮 Future Enhancements

### Planned Features
- Multi-wallet support with active wallet selection
- Advanced path finding for optimal swap routes
- Real-time price feeds and market data
- Enhanced security with additional validation layers

### Scalability Improvements
- Redis caching for frequently accessed data
- Horizontal scaling with load balancing
- Microservices architecture for specific functions

## 🛡️ Security Considerations

### Best Practices
- Never store private keys in plaintext
- Validate all user inputs and XDR data
- Implement rate limiting for API endpoints
- Regular security audits and updates

### Risk Mitigation
- Multiple signing fallbacks ensure reliability
- Transaction limits prevent large-scale losses
- Comprehensive logging for audit trails
- User tier restrictions for sensitive operations

---

*This implementation provides a robust, secure, and user-friendly Stellar wallet experience optimized for Telegram WebView environments while maintaining compatibility with existing systems.*
