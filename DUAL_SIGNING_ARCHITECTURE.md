# LumenBro Dual-Signing Architecture

## 🎯 Overview

This implementation provides a **dual-signing architecture** that optimizes security, user experience, and API load distribution for different types of Stellar operations.

## 🏗️ Architecture Components

### **1. High-Security Operations (Withdrawals)**
- **Use Case**: Payments to external addresses, withdrawals
- **Security Level**: Maximum (password required for each transaction)
- **Signing Method**: Telegram Cloud Storage keys
- **Flow**: Client-side only → Turnkey API → Network submission

### **2. Low-Security Operations (Swaps, Quick Trades)**
- **Use Case**: Internal swaps, quick buys/sells, automated trading
- **Security Level**: Lower (session-based, no password required)
- **Signing Method**: Session keys (KMS encrypted)
- **Flow**: Client → Python bot → Session signing → Network submission

## 🔐 Key Management Strategy

### **Persistent API Keys (Telegram Cloud Storage)**
```javascript
// For high-security operations (withdrawals)
- Encrypted in Telegram Cloud Storage
- Requires password for decryption
- Used for TelegramCloudStorageStamper
- Client-side only flow
- Rate limited by Turnkey API
```

### **Session Keys (KMS + Database)**
```javascript
// For low-security operations (swaps, quick trades)
- Generated during login/recovery
- Encrypted with KMS (same key as Python bot)
- Stored in database
- Python bot can decrypt and sign
- No password required per transaction
- Rate limited by Python bot capacity
```

## 🚀 Implementation Details

### **1. High-Security Transaction Stamper**
```javascript
class SecureTransactionStamper {
  async stamp(xdrPayload) {
    // 1. Initialize TelegramCloudStorageStamper with decrypted keys
    // 2. Create stamp for Turnkey API
    // 3. Return stamp for backend processing
  }
}
```

### **2. Session-Based Transaction Stamper**
```javascript
class SessionTransactionStamper {
  async stamp(xdrPayload, operationType) {
    // 1. Send XDR to Python bot
    // 2. Python bot decrypts session keys with KMS
    // 3. Python bot signs transaction
    // 4. Return signed XDR
  }
}
```

### **3. Transaction Builder**
```javascript
class StellarTransactionBuilder {
  async buildPaymentTransaction(source, destination, amount, asset, memo)
  async buildSwapTransaction(source, sendAsset, sendAmount, destination, destAsset, destMin, path)
}
```

## 🔄 Transaction Flows

### **High-Security Flow (Withdrawals)**
```
1. User enters payment details
2. Build XDR with Stellar SDK bundle
3. User enters password
4. Decrypt Telegram Cloud Storage keys
5. Create TelegramCloudStorageStamper with decrypted keys
6. Stamper creates stamp for Turnkey API
7. Send stamp + XDR to Turnkey API via backend
8. Turnkey API returns signed XDR
9. Submit signed XDR to Stellar network
```

### **Low-Security Flow (Swaps)**
```
1. User enters swap details
2. Build XDR with Stellar SDK bundle
3. Send XDR to Python bot for session-based signing
4. Python bot decrypts session keys with KMS
5. Python bot signs transaction with session keys
6. Return signed XDR to client
7. Submit signed XDR to Stellar network
```

## ⚖️ Load Distribution Benefits

### **API Rate Limit Optimization**
- **Turnkey API**: Only used for high-security operations (withdrawals)
- **Horizon API**: Load distributed between client and Python bot
- **Python Bot**: Handles automated operations (swaps, quick trades)

### **Performance Benefits**
- **Client-side signing**: Reduces backend load
- **Session-based signing**: Enables automated trading
- **Fallback mechanisms**: Ensures reliability

## 🛡️ Security Considerations

### **High-Security Operations**
- Password required for each transaction
- Keys never leave client device
- Telegram Cloud Storage encryption
- Turnkey API rate limiting

### **Low-Security Operations**
- Session-based authentication
- KMS encryption for session keys
- Python bot rate limiting
- Internal operations only

## 📊 Database Schema

### **Enhanced Tables**
```sql
-- Users table with session management
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    pioneer_status BOOLEAN DEFAULT FALSE,
    session_expiry TIMESTAMP,
    turnkey_user_id TEXT,
    user_email TEXT,
    kms_encrypted_session_key TEXT,
    kms_key_id TEXT
);

-- Trades table with operation type tracking
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    xlm_volume DECIMAL,
    tx_hash TEXT,
    turnkey_activity_id TEXT,
    fee_amount DECIMAL,
    fee_asset TEXT,
    operation_type TEXT, -- 'withdrawal', 'swap', 'quick_trade'
    security_level TEXT, -- 'high', 'low'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🎯 API Endpoints

### **High-Security Endpoints**
- `POST /mini-app/sign-transaction` - Turnkey API signing for withdrawals

### **Low-Security Endpoints**
- `POST /mini-app/session-sign-transaction` - Python bot session signing for swaps

### **Shared Endpoints**
- `GET /mini-app/user-status/:telegram_id` - User status and fees
- `POST /mini-app/build-transaction` - Transaction building
- `GET /mini-app/transaction-history/:telegram_id` - Transaction history

## 🔧 Configuration

### **Security Levels**
- **High**: Withdrawals, external payments (password required)
- **Low**: Swaps, quick trades, internal operations (session-based)

### **Rate Limits**
- **Turnkey API**: Per IP, per user
- **Horizon API**: Per IP, per user
- **Python Bot**: Per user, per operation type

## 🧪 Testing

### **High-Security Testing**
```javascript
// Test withdrawal flow
const stamper = createSecureTransactionStamper(privateKey, publicKey);
const stamp = await stamper.stamp(xdr);
```

### **Low-Security Testing**
```javascript
// Test swap flow
const stamper = createSessionTransactionStamper();
const result = await stamper.stamp(xdr, 'swap');
```

## 🔮 Future Enhancements

### **Planned Features**
- Quick buy/sell menu per asset
- Advanced path finding for optimal swap routes
- Real-time price feeds and market data
- Multi-wallet support with active wallet selection

### **Scalability Improvements**
- Redis caching for frequently accessed data
- Horizontal scaling with load balancing
- Microservices architecture for specific functions

## 🛡️ Security Best Practices

### **Key Management**
- Never store private keys in plaintext
- Use KMS for session key encryption
- Implement proper key rotation
- Regular security audits

### **Transaction Security**
- Validate all user inputs and XDR data
- Implement rate limiting for API endpoints
- Monitor for suspicious activity
- Comprehensive logging for audit trails

---

*This dual-signing architecture provides optimal security, performance, and user experience while distributing API load effectively across different services.*
