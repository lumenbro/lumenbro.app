# 🔐 Hybrid Signing Architecture for LumenBro Wallet

## 🎯 **Concept Overview**

**Hybrid Signing** combines client-side manual signing with server-side automated signing for the ultimate user experience:

### **1. Client-Side Signing (Manual)**
- **Password-Protected Keys**: Use Telegram Cloud stored encrypted keys
- **DApp Connections**: Direct signing for user-initiated actions
- **Password Prompt**: User enters password to unlock keys temporarily
- **Turnkey SDK**: Client-side signing with stored credentials

### **2. Server-Side Signing (Automated)**
- **Bot Endpoint**: Python bot handles automated transactions
- **Copy Trading**: Quick buys/sells without user interaction
- **Session Keys**: Use existing KMS-encrypted session data
- **No Password**: Seamless automated operations

## 🏗️ **Architecture Components**

### **A. Client-Side Signing Flow**

```javascript
// 1. User initiates DApp connection or manual transaction
// 2. Password prompt appears
// 3. Decrypt Telegram Cloud keys with password
// 4. Use Turnkey SDK for client-side signing
// 5. Submit signed transaction directly to network

class ClientSideSigner {
  async signTransaction(transaction, password) {
    // 1. Get encrypted keys from Telegram Cloud
    const encryptedKeys = await this.getTelegramCloudKeys();
    
    // 2. Decrypt with user password
    const decryptedKeys = await this.decryptWithPassword(encryptedKeys, password);
    
    // 3. Use Turnkey SDK for signing
    const signature = await Turnkey.signWithApiKey({
      privateKey: decryptedKeys.privateKey,
      content: transaction.toXDR()
    });
    
    // 4. Return signed transaction
    return transaction.addSignature(signature);
  }
}
```

### **B. Server-Side Signing Flow**

```javascript
// 1. Automated transaction (copy trading, quick buy)
// 2. Python bot receives unsigned XDR
// 3. Decrypt session keys from database using KMS
// 4. Sign transaction server-side
// 5. Submit to network

// Python Bot Endpoint (existing)
@app.post('/api/sign')
async def sign_transaction(xdr, action_type, amount):
    # 1. Get user session from database
    session = await get_user_session(user_id)
    
    # 2. Decrypt session keys using KMS
    decrypted_keys = await kms_decrypt(session.encrypted_keys)
    
    # 3. Sign transaction
    signed_xdr = await sign_with_turnkey(xdr, decrypted_keys)
    
    # 4. Return signed XDR
    return {"signed_xdr": signed_xdr}
```

## 🔧 **Implementation Plan**

### **Phase 1: Client-Side Signing Integration**

#### **1.1 Password-Protected Key Management**
```javascript
// Enhanced wallet with password prompt
class SecureWallet {
  constructor() {
    this.telegramCloud = new TelegramCloudStorage();
    this.turnkeySDK = new TurnkeySDK();
  }
  
  async unlockKeys(password) {
    try {
      // Get encrypted keys from Telegram Cloud
      const encryptedData = await this.telegramCloud.get('wallet_keys');
      
      // Decrypt with password
      const decryptedKeys = await this.decryptWithPassword(encryptedData, password);
      
      // Store temporarily in memory (not localStorage)
      this.tempKeys = decryptedKeys;
      
      return true;
    } catch (error) {
      throw new Error('Invalid password or corrupted keys');
    }
  }
  
  async signForDApp(transaction, dappName) {
    if (!this.tempKeys) {
      throw new Error('Keys not unlocked. Please enter password first.');
    }
    
    // Use Turnkey SDK for signing
    const signature = await this.turnkeySDK.signWithApiKey({
      privateKey: this.tempKeys.privateKey,
      content: transaction.toXDR(),
      scheme: "SIGNATURE_SCHEME_TK_API_P256"
    });
    
    // Log DApp interaction
    this.logDAppInteraction(dappName, transaction);
    
    return transaction.addSignature(signature);
  }
}
```

#### **1.2 DApp Connection Interface**
```javascript
// DApp browser with signing capabilities
class DAppBrowser {
  async connectToDApp(dappUrl) {
    // 1. Show password prompt
    const password = await this.showPasswordPrompt();
    
    // 2. Unlock keys
    await this.wallet.unlockKeys(password);
    
    // 3. Establish connection
    const connection = await this.establishConnection(dappUrl);
    
    // 4. Handle signing requests
    connection.onSignRequest = async (transaction) => {
      return await this.wallet.signForDApp(transaction, dappUrl);
    };
    
    return connection;
  }
}
```

### **Phase 2: Server-Side Automation**

#### **2.1 Enhanced Python Bot**
```python
# Enhanced signing endpoint for automated transactions
@app.post('/api/sign/automated')
async def sign_automated_transaction(request):
    # 1. Validate request (copy trading, quick buy, etc.)
    transaction_type = request.get('type')
    xdr = request.get('xdr')
    user_id = request.get('user_id')
    
    # 2. Get user session from database
    session = await get_user_session(user_id)
    
    # 3. Decrypt session keys using KMS
    decrypted_keys = await kms_service.decrypt_session_key(
        session.kms_encrypted_session_key
    )
    
    # 4. Sign transaction
    signed_xdr = await turnkey_client.sign_transaction(
        xdr, 
        decrypted_keys
    )
    
    # 5. Submit to network
    result = await stellar_client.submit_transaction(signed_xdr)
    
    return {
        "success": True,
        "hash": result.hash,
        "type": transaction_type
    }
```

#### **2.2 Copy Trading Integration**
```python
# Copy trading with automated signing
class CopyTradingBot:
    async def execute_copy_trade(self, user_id, trade_signal):
        # 1. Build transaction
        transaction = await self.build_trade_transaction(trade_signal)
        
        # 2. Sign automatically (no password needed)
        signed_tx = await self.sign_automated_transaction(
            user_id, 
            transaction.toXDR()
        )
        
        # 3. Submit to network
        result = await self.submit_transaction(signed_tx)
        
        # 4. Update user portfolio
        await self.update_portfolio(user_id, result)
        
        return result
```

### **Phase 3: Unified Wallet Interface**

#### **3.1 Smart Signing Decision**
```javascript
// Wallet decides signing method based on context
class SmartWallet {
  async signTransaction(transaction, context) {
    switch (context.type) {
      case 'dapp_connection':
      case 'manual_payment':
      case 'user_initiated':
        // Use client-side signing with password
        return await this.clientSideSign(transaction);
        
      case 'copy_trading':
      case 'automated_buy':
      case 'quick_sell':
        // Use server-side signing (no password)
        return await this.serverSideSign(transaction);
        
      default:
        // Ask user preference
        return await this.askUserPreference(transaction);
    }
  }
}
```

#### **3.2 Enhanced UI Components**
```javascript
// Password prompt component
class PasswordPrompt {
  async show() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div class="password-modal">
          <h3>🔐 Unlock Wallet</h3>
          <p>Enter your password to sign this transaction</p>
          <input type="password" id="wallet-password" placeholder="Password">
          <button onclick="submitPassword()">Unlock & Sign</button>
          <button onclick="cancelSigning()">Cancel</button>
        </div>
      `;
      
      document.body.appendChild(modal);
    });
  }
}
```

## 🚀 **Benefits of This Architecture**

### **✅ Security**
- **Client-side**: Keys never leave user's device
- **Server-side**: KMS encryption for automated operations
- **Password protection**: Manual operations require user consent

### **✅ User Experience**
- **Seamless automation**: Copy trading works without interruption
- **Manual control**: DApp connections require explicit consent
- **Flexible**: Users can choose signing method per transaction

### **✅ Scalability**
- **Hybrid approach**: Best of both worlds
- **Turnkey SDK**: Proven signing infrastructure
- **Telegram Cloud**: Secure key storage

## 🔄 **Integration with Existing Code**

### **1. Update Wallet Interface**
```javascript
// Add to modern-wallet-ui.html
window.signTransaction = async function(transaction, context) {
  if (context.requiresPassword) {
    // Client-side signing
    const password = await showPasswordPrompt();
    return await clientSideSigner.sign(transaction, password);
  } else {
    // Server-side signing
    return await serverSideSigner.sign(transaction);
  }
};
```

### **2. DApp Browser Integration**
```javascript
// Add to wallet navigation
case 'apps':
  mainContent.innerHTML = `
    <div class="wallet-header">
      <h1 class="wallet-title">📱 DApps</h1>
      <p class="wallet-subtitle">Connect to Stellar applications</p>
    </div>
    
    <div class="wallet-card">
      <div class="card-header">
        <div class="card-icon">🔗</div>
        <div class="card-title">Connect to DApp</div>
      </div>
      
      <div class="form-group">
        <label class="form-label">DApp URL</label>
        <input type="url" class="form-input" id="dappUrl" 
               placeholder="https://dapp.example.com">
      </div>
      
      <div class="btn-group">
        <button class="btn btn-primary" onclick="connectToDApp()">
          🔗 Connect & Sign
        </button>
      </div>
    </div>
  `;
  break;
```

## 🎯 **Next Steps**

1. **Implement client-side signing** with Turnkey SDK
2. **Add password prompt UI** to wallet interface
3. **Enhance Python bot** for automated signing
4. **Create DApp browser** with signing capabilities
5. **Test hybrid flow** with real transactions

This architecture gives you the best of both worlds: **security for manual operations** and **convenience for automated trading**! 🚀
