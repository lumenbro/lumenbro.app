# 🧪 Stellar-Plus Wallet Test

This is a standalone test environment to explore Stellar-Plus functionality before integrating into your mini-app.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Test Server
```bash
npm start
```

### 3. Open in Browser
Navigate to: http://localhost:3000

## 🎯 What This Tests

### ✅ **Stellar-Plus Integration**
- Mock Stellar-Plus API calls
- Transaction building
- Account management
- Balance checking

### ✅ **API Signing Flow**
- Simulates your Python bot signing endpoint
- XDR envelope handling
- Mock transaction signing
- Fee calculation

### ✅ **Mini-App Architecture**
- Browser-based wallet interface
- API communication patterns
- Error handling
- User experience flow

## 🔧 Test Features

### **💰 Balance Display**
- Shows mock XLM balance
- Displays public key
- Refresh functionality

### **📤 Payment Sending**
- Build transactions with Stellar-Plus
- Send to signing API
- Mock network submission
- Success/error handling

### **🔐 Transaction Signing**
- Test signing API endpoint
- XDR envelope handling
- Fee calculation simulation

## 🏗️ Architecture

```
Browser (localhost:3000)
    ↓
Express Server (test-wallet-server.js)
    ↓
Mock API Endpoints (/api/sign, /api/balance)
    ↓
Simulated Stellar-Plus Integration
```

## 🔄 Integration Flow

1. **User clicks "Send Payment"**
2. **Stellar-Plus builds transaction** (client-side)
3. **XDR sent to signing API** (simulates your Python bot)
4. **Signed XDR returned**
5. **Transaction submitted to network**

## 📱 Next Steps

Once this test environment works:

1. **Replace mock Stellar-Plus** with real library
2. **Connect to your Python bot** (port 8080)
3. **Integrate into mini-app** recovery flow
4. **Replace broken wallet button** with working interface

## 🎯 Key Benefits

- **🧪 Safe Testing**: No real transactions
- **🔧 Easy Debugging**: Clear logging
- **📱 Mini-App Ready**: Same patterns as your app
- **⚡ Fast Development**: No deployment needed

## 🚨 Important Notes

- This uses **mock data** - no real Stellar transactions
- **Stellar-Plus is simulated** - replace with real library
- **Signing is mocked** - will connect to your Python bot
- **Testnet only** - safe for development

## 🔗 Integration Points

### **Your Python Bot (Port 8080)**
```javascript
// Replace mock API with real bot
const response = await fetch('http://localhost:8080/api/sign', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({ xdr, telegram_id })
});
```

### **Real Stellar-Plus**
```javascript
// Replace mock with real library
import { StellarPlus } from 'stellar-plus';

const stellarPlus = new StellarPlus({
  network: 'testnet',
  rpcUrl: 'https://soroban-testnet.stellar.org'
});
```

## 🎉 Success Criteria

✅ **Balance loads correctly**
✅ **Payment flow works end-to-end**
✅ **Signing API responds properly**
✅ **Error handling works**
✅ **UI is responsive and clear**

Ready to integrate into your mini-app! 🚀

