# 🔐 Turnkey Cloud Stamper Testing Guide

## **Critical Security Considerations**

### **⚠️ IMPORTANT: Live Funds Protection**
- **NEVER test with real funds** on mainnet
- **ALWAYS use testnet** for initial testing
- **Use small amounts** even on testnet
- **Verify all signatures** before network submission

## **Testing Environment Setup**

### **1. Test User Configuration**
```javascript
// Your existing test user
const TEST_USER = {
    telegramId: 5014800072,
    email: 'bpeterscqa@gmail.com',
    publicKey: 'G...', // Will be fetched from authenticator
    hasApiKey: true,
    hasAuthenticator: true
};
```

### **2. Test Network Configuration**
```javascript
// Use Stellar Testnet for all testing
const TESTNET_CONFIG = {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    friendbotUrl: 'https://horizon-testnet.stellar.org/friendbot'
};
```

## **Testing Strategy**

### **Phase 1: Infrastructure Testing (Safe)**
1. **✅ User Authentication** - Verify test user exists
2. **✅ Transaction Building** - Build XDR without signing
3. **✅ Fee Calculation** - Test fee logic
4. **✅ Asset Metadata** - Test icon loading
5. **✅ Database Logging** - Test fee/reward logging

### **Phase 2: Turnkey Integration Testing (Safe)**
1. **✅ Cloud Stamper Initialization** - Test connection
2. **✅ Mock Signing** - Test signature format
3. **✅ Error Handling** - Test failure scenarios
4. **✅ Security Validation** - Test auth checks

### **Phase 3: Network Testing (Testnet Only)**
1. **⚠️ Testnet Transaction Submission** - Small amounts only
2. **⚠️ Signature Verification** - Verify on-chain
3. **⚠️ Fee Collection** - Verify fees are collected
4. **⚠️ Error Recovery** - Test network failures

## **Running the Test Suite**

### **1. Start Local Server**
```bash
npm start
```

### **2. Run Infrastructure Tests**
```bash
node test-turnkey-stamper.js
```

### **3. Expected Results**
```
🚀 Starting comprehensive Turnkey Cloud Stamper tests...

🧪 Test 1: Verifying test user setup...
✅ Test user found: { telegramId: 5014800072, publicKey: 'G...', hasApiKey: true, hasAuthenticator: true }

🧪 Test 2: Testing transaction building...
✅ Transaction built successfully: { networkFee: '0.00001', serviceFee: '0.00001', total: '0.00002' }

🧪 Test 3: Testing Turnkey Cloud Stamper initialization...
✅ Turnkey integration ready: Python bot connected successfully

🧪 Test 4: Testing fee calculation and logging...
✅ Fee logging successful: { tradeId: 123, xlmEquivalent: 1.0, feeAmount: 0.01, feePercentage: 0.01, referralReward: null }

🧪 Test 5: Testing asset metadata fetching...
✅ Asset metadata test: { success: true, hasIcon: true, hasName: true }

📊 Test Results Summary:
========================
✅ userSetup: PASSED
✅ transactionBuilding: PASSED
✅ stamperInitialization: PASSED
✅ feeLogging: PASSED
✅ assetMetadata: PASSED

🎉 ALL TESTS PASSED!
```

## **Security Testing Checklist**

### **✅ Authentication Tests**
- [ ] Test user must be authenticated
- [ ] Telegram initData validation
- [ ] Cloud storage key validation
- [ ] Session expiry checks

### **✅ Authorization Tests**
- [ ] User can only sign their own transactions
- [ ] Transaction amount limits
- [ ] Asset authorization checks
- [ ] Fee calculation validation

### **✅ Transaction Security**
- [ ] XDR validation before signing
- [ ] Network fee validation
- [ ] Memo validation (if required)
- [ ] Destination address validation

### **✅ Error Handling**
- [ ] Network failures
- [ ] Turnkey API failures
- [ ] Invalid signatures
- [ ] Database failures

## **Trustline Operations (Your Question)**

### **Smart Trustline Handling**
```javascript
// Determine if trustline operation needs auth
function needsAuthForTrustline(operation) {
    // Allow trustlines for known assets without auth
    const trustedAssets = ['XLM', 'USDC', 'CHAD', 'NUT'];
    
    if (trustedAssets.includes(operation.assetCode)) {
        return false; // No auth needed for trusted assets
    }
    
    // Require auth for unknown assets
    return true;
}

// Combine operations when possible
function combineOperations(operations) {
    const needsAuth = operations.some(op => needsAuthForTrustline(op));
    
    if (!needsAuth) {
        // Single transaction - no auth needed
        return { type: 'single', needsAuth: false };
    } else {
        // Separate transactions - auth needed for sensitive ops
        return { type: 'separate', needsAuth: true };
    }
}
```

## **Testing Turnkey Cloud Stamper**

### **1. Client-Side Testing**
```javascript
// Test Turnkey Cloud Stamper initialization
async function testCloudStamper() {
    try {
        const stamper = new Turnkey.TelegramCloudStorageStamper();
        
        // Test with mock hash (safe)
        const mockHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        
        const signature = await stamper.signRawPayloadV2(mockHash, {
            encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
            hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE'
        });
        
        console.log('✅ Cloud Stamper test successful:', {
            r: signature.r?.substring(0, 10) + '...',
            s: signature.s?.substring(0, 10) + '...'
        });
        
        return signature;
    } catch (error) {
        console.error('❌ Cloud Stamper test failed:', error);
        throw error;
    }
}
```

### **2. Server-Side Integration Testing**
```javascript
// Test Python bot integration
async function testPythonBotIntegration() {
    try {
        const response = await fetch('/mini-app/test-python-connection');
        const result = await response.json();
        
        if (!result.success) {
            throw new Error('Python bot connection failed');
        }
        
        console.log('✅ Python bot integration ready');
        return result;
    } catch (error) {
        console.error('❌ Python bot integration failed:', error);
        throw error;
    }
}
```

## **Production Deployment Checklist**

### **Before Going Live**
- [ ] All tests pass on testnet
- [ ] Security audit completed
- [ ] Error handling tested
- [ ] Monitoring setup
- [ ] Rollback plan ready
- [ ] Small amount testing on mainnet
- [ ] Fee collection verified
- [ ] User feedback collected

### **Monitoring**
- [ ] Transaction success rates
- [ ] Fee collection accuracy
- [ ] Error rates and types
- [ ] User authentication success
- [ ] Turnkey API response times

## **Emergency Procedures**

### **If Something Goes Wrong**
1. **Immediate**: Disable transaction signing
2. **Investigate**: Check logs and error reports
3. **Rollback**: Revert to previous stable version
4. **Notify**: Alert users of temporary service interruption
5. **Fix**: Address the issue in test environment
6. **Test**: Verify fix works before redeployment

## **Next Steps**

1. **Run the test suite** to verify current functionality
2. **Implement Turnkey Cloud Stamper** integration
3. **Test on Stellar testnet** with small amounts
4. **Verify fee collection** and logging
5. **Deploy to production** with monitoring

**Remember: Security first, testing second, deployment last! 🔐**

