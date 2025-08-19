# LumenBro Chat Context Summary

## 🎯 **Current Mission**
Building a **hybrid transaction signing system** for Telegram Mini App with Turnkey integration, emphasizing **client-side flow** with backend fallbacks.

---

## 📊 **Recent Major Developments**

### **1. P&L Integration Reversion (Critical)**
- **Issue**: P&L integration "nuked the old CSS" and broke UI
- **Solution**: Reverted `index.html` to stable version
- **Status**: ✅ **RESOLVED** - UI restored to working state

### **2. Transaction Signing Architecture Evolution**
- **Goal**: Client-side XDR building + Turnkey signing + network submission
- **Challenge**: CDN loading failures in WebView environments
- **Current State**: Hybrid approach with backend fallbacks

---

## 🔧 **Technical Architecture**

### **Database Schema (Shared with Python Bot)**
```sql
-- Users table (KMS encrypted sessions)
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    kms_encrypted_session_key TEXT,
    kms_key_id TEXT,
    session_expiry TIMESTAMP,
    -- ... other fields
);

-- Trades table (Transaction logging)
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    xlm_volume DECIMAL,
    tx_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards table (Referral tracking)
CREATE TABLE rewards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    amount DECIMAL,
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **KMS Integration**
- **Key ID**: `27958fe3-0f3f-44d4-b21d-9d820d5ad96c`
- **Region**: `us-west-1`
- **Purpose**: Encrypt session keys (Node.js) → Decrypt (Python bot)

---

## 🚀 **Current Transaction Flow**

### **Client-Side (Preferred)**
1. **XDR Building**: Attempt with Stellar SDK CDN
2. **Signing**: `TelegramCloudStorageStamper` with decrypted keys
3. **Submission**: Direct to Stellar network

### **Backend Fallback (Working)**
1. **XDR Building**: `/mini-app/build-xdr` endpoint
2. **Signing**: `/mini-app/sign-payload` endpoint
3. **Submission**: Backend handles network submission

---

## ⚠️ **Critical Challenges**

### **1. SDK Loading Issues**
- **Problem**: CDNs fail in WebView environments
- **Impact**: Client-side XDR building unreliable
- **Solution Needed**: Local Stellar SDK bundle

### **2. Database Consistency**
- **Requirement**: Node.js and Python bot share same schema
- **Challenge**: Schema changes must be coordinated
- **Status**: ✅ **RESOLVED** - Tables match Python bot

### **3. Legacy User Protection**
- **Requirement**: Never overwrite existing Turnkey wallets
- **Implementation**: Safety checks before wallet creation
- **Status**: ✅ **IMPLEMENTED** - Both Node.js and Python

---

## 🎯 **Tomorrow's Priority: Stellar SDK Bundle**

### **Goal**
Create local bundle similar to `turnkey-entry.js` for Stellar SDK

### **Benefits**
- **Reliable loading** - No CDN dependencies
- **Full client-side flow** - Build → Sign → Submit
- **Better performance** - No backend round-trips
- **True non-custodial** - Everything client-side

### **Technical Approach**
```javascript
// Target: window.StellarSdk (like window.Turnkey)
// Bundle: Stellar SDK + dependencies
// Usage: Client-side XDR building
```

---

## 📱 **Key Files & Components**

### **Frontend**
- `public/mini-app/index.html` - Main Mini App interface
- `public/mini-app/transaction-stamper.js` - Turnkey signing wrapper
- `public/mini-app/encryption-utils.js` - Key management
- `public/turnkey.js` - Turnkey SDK bundle

### **Backend**
- `routes/auth.js` - Transaction endpoints + referral logic
- `services/kmsService.js` - KMS encryption/decryption
- `app.js` - Main Express server

### **Database**
- `scripts/add-turnkey-tables.sql` - Schema definitions
- Shared PostgreSQL with Python bot

---

## 🔄 **Recent Error Resolution**

### **Resolved Issues**
1. ✅ `ReferenceError: path is not defined` - Added import
2. ✅ `ECONNREFUSED` - Python bot binding to `0.0.0.0:8080`
3. ✅ `stamper.signRawPayload is not a function` - Using `stamp()` method
4. ✅ `Cannot create a key using the specified key usages` - JWK import fixes
5. ✅ `column "turnkey_activity_id" does not exist` - Schema alignment
6. ✅ `Horizon could not decode the transaction envelope` - XDR construction fixes

### **Current Status**
- ✅ **Backend fallback working perfectly**
- ✅ **TelegramCloudStorageStamper operational**
- ✅ **Database logging and referral rewards implemented**
- ⏳ **Client-side SDK bundle needed**

---

## 🎯 **Next Steps**

### **Immediate (Tomorrow)**
1. **Build Stellar SDK bundle** - Local deployment
2. **Test client-side XDR building** - Full flow validation
3. **Optimize performance** - Remove backend dependencies

### **Future Considerations**
- **Multi-wallet support** - Active wallet selection
- **Enhanced security** - Additional validation layers
- **Performance optimization** - Caching and optimization

---

## 🔐 **Security Architecture**

### **Key Management**
- **Client-side**: Encrypted keys in Telegram Cloud Storage
- **Backend**: KMS encrypted session keys
- **Signing**: `TelegramCloudStorageStamper` with decrypted keys

### **Transaction Security**
- **XDR validation** - Backend verification
- **Signature verification** - Stellar network validation
- **Referral tracking** - Secure reward calculation

---

## 📊 **Success Metrics**

### **Current Achievements**
- ✅ **Stable UI** - Reverted from broken P&L integration
- ✅ **Working transaction flow** - Backend fallback operational
- ✅ **Database consistency** - Shared schema with Python bot
- ✅ **Referral system** - Multi-level reward calculation
- ✅ **Security** - KMS integration + client-side key protection

### **Target Achievements**
- 🎯 **Full client-side flow** - No backend dependencies
- 🎯 **Reliable SDK loading** - Local bundle deployment
- 🎯 **Performance optimization** - Reduced latency
- 🎯 **Scalability** - Handle increased transaction volume

---

*Last Updated: Current session - Focus on Stellar SDK bundle for client-side transaction flow*
