# Signing Integration Test Guide

## 🎯 **Testing Strategy for Turnkey Integration**

### **Option 1: Use Your Own Test User (Recommended)**

#### **Step 1: Find Your Test User**
```sql
-- Check if you have a test user in the database
SELECT telegram_id, user_email, public_key, kms_encrypted_session_key 
FROM users 
WHERE telegram_id = YOUR_TELEGRAM_ID;
```

#### **Step 2: Update Test Script**
Edit `test-signing-integration.js` and replace:
```javascript
const testTelegramId = 123456789; // Replace with your actual telegram_id
```

#### **Step 3: Test the Integration**
```bash
# Test Python connection
curl -X GET http://localhost:3000/mini-app/test-python-connection

# Test signing (replace with your telegram_id)
curl -X POST http://localhost:3000/mini-app/test-sign-transaction \
  -H "Content-Type: application/json" \
  -d '{"xdr":"YOUR_XDR_HERE","transaction_type":"payment","include_fee":false}'
```

### **Option 2: Create a Test User**

#### **Step 1: Register via Mini-App**
1. **Open**: `http://localhost:3000/mini-app/`
2. **Click**: "Register"
3. **Enter**: Your email
4. **Complete**: Turnkey registration
5. **Note**: Your `telegram_id` from the process

#### **Step 2: Update Test Script**
Replace the test telegram_id with your new user's ID.

### **Option 3: Use Real XDR Data**

#### **Step 1: Generate Real XDR**
```javascript
// In your browser console or test script
const StellarPlus = require('stellar-plus');

// Create a test transaction
const transaction = new StellarPlus.Transaction({
  network: 'testnet', // or 'mainnet'
  source: 'YOUR_PUBLIC_KEY',
  fee: 100
});

// Add payment operation
transaction.addOperation(
  StellarPlus.Operation.payment({
    destination: 'DESTINATION_PUBLIC_KEY',
    asset: StellarPlus.Asset.native(),
    amount: '10'
  })
);

// Get XDR
const xdr = transaction.toXDR();
console.log('XDR:', xdr);
```

#### **Step 2: Test with Real XDR**
```bash
curl -X POST http://localhost:3000/mini-app/test-sign-transaction \
  -H "Content-Type: application/json" \
  -d '{"xdr":"REAL_XDR_HERE","transaction_type":"payment","include_fee":true}'
```

## 🧪 **Testing Endpoints**

### **1. Python Connection Test**
```bash
GET /mini-app/test-python-connection
```
**Purpose**: Verify Node.js can reach Python bot
**Expected**: Success if Python bot is running on port 8080

### **2. User Authenticator Type**
```bash
GET /mini-app/user-authenticator-type/{telegram_id}
```
**Purpose**: Check user's signing method (KMS, Telegram Cloud, Legacy)
**Expected**: Returns user type and session status

### **3. Test Signing**
```bash
POST /mini-app/test-sign-transaction
```
**Purpose**: Test full signing flow with test user
**Expected**: Returns signed XDR and transaction hash

### **4. Production Signing**
```bash
POST /mini-app/sign-transaction
```
**Purpose**: Real signing for authenticated users
**Expected**: Returns signed XDR for actual transactions

## 🔧 **Troubleshooting**

### **Issue 1: "Test user not found"**
**Solution**: 
1. Check if user exists in database
2. Update test telegram_id in the script
3. Create a test user via mini-app registration

### **Issue 2: "No active session"**
**Solution**:
1. User needs to log in via mini-app first
2. Check session expiry in database
3. Re-login to refresh session

### **Issue 3: "Python bot connection failed"**
**Solution**:
1. Ensure Python bot is running on port 8080
2. Check security groups allow VPC communication
3. Verify JWT secret is set correctly

### **Issue 4: "Invalid XDR"**
**Solution**:
1. Use real XDR from Stellar transaction
2. Ensure XDR is properly formatted
3. Test with simple payment transaction first

## 🚀 **Quick Test Commands**

### **Local Testing**
```bash
# Start Node.js server
npm start

# Test Python connection
node test-signing-integration.js

# Test specific endpoint
curl -X GET http://localhost:3000/mini-app/test-python-connection
```

### **Production Testing**
```bash
# Test on EC2 (replace with your domain)
curl -X GET https://your-domain.com/mini-app/test-python-connection

# Test signing (replace telegram_id and xdr)
curl -X POST https://your-domain.com/mini-app/test-sign-transaction \
  -H "Content-Type: application/json" \
  -d '{"xdr":"YOUR_XDR","transaction_type":"payment"}'
```

## 📋 **Test Checklist**

- [ ] Node.js server running
- [ ] Python bot running on port 8080
- [ ] Test user exists in database
- [ ] Test user has active session
- [ ] JWT secret configured
- [ ] Security groups allow VPC communication
- [ ] Real XDR data available
- [ ] Turnkey wallet properly configured

## 🎯 **Next Steps After Testing**

1. **Verify signing works** with test user
2. **Test fee calculation** with different user types
3. **Test error handling** with invalid XDR
4. **Deploy to production** once local tests pass
5. **Test with real mini-app** users

## 🔐 **Security Notes**

- **Test endpoints** are for development only
- **Remove test endpoints** before production
- **Use real JWT secrets** in production
- **Validate all XDR** before signing
- **Log all signing attempts** for security
