// transaction-stamper.js - Dual-signing architecture for Stellar wallet
// High-security: Client-side with Telegram Cloud Storage keys (withdrawals)
// Low-security: Session-based with Python bot (swaps, quick trades)
// Fallback: Server-side signing for compatibility

// Helper functions (copied from login.js for independence)
function hexToUint8Array(hex) {
  if (!hex) throw new Error('Hex string is undefined or empty');
  
  try {
    const cleanHex = hex.replace(/^0x/, '');
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    
    const pairs = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      pairs.push(cleanHex.substr(i, 2));
    }
    
    return new Uint8Array(pairs.map(byte => parseInt(byte, 16)));
  } catch (error) {
    console.error('❌ hexToUint8Array error:', error);
    throw new Error(`Hex conversion failed: ${error.message}`);
  }
}

function bytesToBase64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// High-security transaction stamper for withdrawals (client-side only)
class SecureTransactionStamper {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.stamper = null; // Will be initialized in stamp method
  }

  async stamp(xdrPayload) {
    try {
      console.log('🔐 Starting high-security transaction stamping...');
      console.log('📝 XDR payload length:', xdrPayload.length);
      
      // Initialize the TelegramCloudStorageStamper with decrypted keys
      if (!this.stamper) {
        console.log('🔧 Initializing TelegramCloudStorageStamper with decrypted keys...');
        
        this.stamper = new window.Turnkey.TelegramCloudStorageStamper();
        
        // Pass decrypted keys directly to the stamper
        await this.stamper.setSigningKey({
          cloudStorageAPIKey: {
            apiPublicKey: this.publicKey,
            apiPrivateKey: this.privateKey
          }
        });
        
        console.log('✅ TelegramCloudStorageStamper initialized with decrypted keys');
      }
      
      // Use the stamper to create a stamp for Turnkey API
      console.log('🔧 Creating stamp with TelegramCloudStorageStamper...');
      const stampResult = await this.stamper.stamp(xdrPayload);
      
      console.log('✅ Stamp created successfully');
      console.log('🔍 Stamp result:', stampResult);
      
      // The stamper should return a stamp that we can send to Turnkey API
      // This stamp contains the signature and metadata needed for Turnkey
        return {
          publicKey: this.publicKey,
          scheme: "SIGNATURE_SCHEME_TK_API_P256",
        stamp: stampResult,
        xdrPayload: xdrPayload,
        source: 'client-secure',
        securityLevel: 'high'
      };

    } catch (error) {
      console.error('❌ TelegramCloudStorageStamper failed:', error);
      throw new Error('High-security signing failed - please try again');
    }
  }
}

// Session-based transaction stamper for automated operations (Python bot)
class SessionTransactionStamper {
  constructor() {
    // No keys needed - uses session keys from database
  }

  async stamp(xdrPayload, operationType = 'swap') {
    try {
      console.log('🤖 Starting session-based transaction stamping...');
      console.log('📝 XDR payload length:', xdrPayload.length);
      console.log('🔧 Operation type:', operationType);
      
      // Send to Python bot for session-based signing
      const response = await fetch('/mini-app/session-sign-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xdr: xdrPayload,
          operationType: operationType,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Session signing failed');
      }

      const result = await response.json();
      console.log('✅ Session-based signing successful');
      
      return {
        publicKey: result.publicKey,
        scheme: "SIGNATURE_SCHEME_SESSION",
        signedXdr: result.signed_xdr,
        source: 'python-bot',
        securityLevel: 'low',
        operationType: operationType
      };

    } catch (error) {
      console.error('❌ Session-based signing failed:', error);
      throw new Error('Session signing failed - please try again');
    }
  }
}

// Enhanced transaction builder with Stellar SDK support
class StellarTransactionBuilder {
  constructor() {
    this.stellarSdk = null;
    this.server = null;
    this.loadAccount = null;
  }

  async initialize() {
    if (typeof window.StellarSdk !== 'undefined') {
      this.stellarSdk = window.StellarSdk;
      try {
        // Prefer Server if available; otherwise fall back to REST fetch
        if (this.stellarSdk.Server && typeof this.stellarSdk.Server === 'function') {
          this.server = new this.stellarSdk.Server('https://horizon.stellar.org');
          this.loadAccount = async (publicKey) => this.server.loadAccount(publicKey);
          console.log('✅ Stellar SDK initialized with Server');
        } else {
          this.loadAccount = async (publicKey) => {
            const resp = await fetch(`https://horizon.stellar.org/accounts/${publicKey}`);
            if (!resp.ok) throw new Error(`Horizon accounts fetch failed: ${resp.status}`);
            const data = await resp.json();
            return new this.stellarSdk.Account(publicKey, data.sequence);
          };
          console.log('✅ Stellar SDK initialized with REST fallback');
        }
        console.log('✅ Stellar SDK initialized for transaction building');
        return true;
      } catch (error) {
        console.error('❌ Failed to initialize Stellar Server:', error);
        // As an additional fallback, try REST path even if Server constructor failed
        this.loadAccount = async (publicKey) => {
          const resp = await fetch(`https://horizon.stellar.org/accounts/${publicKey}`);
          if (!resp.ok) throw new Error(`Horizon accounts fetch failed: ${resp.status}`);
          const data = await resp.json();
          return new this.stellarSdk.Account(publicKey, data.sequence);
        };
        return false;
      }
    } else {
      console.log('⚠️ Stellar SDK not available, will use backend for transaction building');
      return false;
    }
  }

  async buildPaymentTransaction(sourceAccount, destination, amount, asset = 'XLM', memo = null) {
    try {
      if (this.stellarSdk && this.loadAccount) {
        // Client-side transaction building
        console.log('🔧 Building payment transaction client-side...');
        console.log('Source account:', sourceAccount);
        console.log('Destination:', destination);
        console.log('Amount:', amount);
        console.log('Asset:', asset);
        
        const account = await this.loadAccount(sourceAccount);
        console.log('✅ Account loaded:', account.accountId());
        
        const transaction = new this.stellarSdk.TransactionBuilder(account, {
          fee: this.stellarSdk.BASE_FEE,
          networkPassphrase: this.stellarSdk.Networks.PUBLIC
        })
        .addOperation(this.stellarSdk.Operation.payment({
          destination: destination,
          asset: asset === 'XLM' ? this.stellarSdk.Asset.native() : 
                 new this.stellarSdk.Asset(asset.code, asset.issuer),
          amount: amount.toString()
        }))
        .setTimeout(30);
        
        if (memo) {
          transaction.addMemo(this.stellarSdk.Memo.text(memo));
        }
        
        const builtTransaction = transaction.build();
        const xdr = builtTransaction.toXDR();
        
        console.log('✅ Payment transaction built client-side');
        return { xdr, source: 'client' };
        
      } else {
        // Backend transaction building
        console.log('🔄 Using backend for transaction building...');
        
        const response = await fetch('/mini-app/build-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourcePublicKey: sourceAccount,
            transactionData: {
              recipient: destination,
              amount: amount,
              asset: asset,
              memo: memo
            },
            operationType: 'payment',
            telegram_id: (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user && window.Telegram.WebApp.initDataUnsafe.user.id) || undefined
          })
        });
        
        if (!response.ok) {
          throw new Error(`Backend transaction building failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Payment transaction built by backend');
        return { xdr: result.xdr, source: 'server' };
      }
      
    } catch (error) {
      console.error('❌ Client-side transaction building failed:', error);
      console.log('🔄 Falling back to backend transaction building...');
      
      // Fallback to backend
      try {
        const response = await fetch('/mini-app/build-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourcePublicKey: sourceAccount,
            transactionData: {
              recipient: destination,
              amount: amount,
              asset: asset,
              memo: memo
            },
            operationType: 'payment',
            telegram_id: (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user && window.Telegram.WebApp.initDataUnsafe.user.id) || undefined
          })
        });
        
        if (!response.ok) {
          throw new Error(`Backend transaction building failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Payment transaction built by backend fallback');
        return { xdr: result.xdr, source: 'server-fallback' };
      } catch (fallbackError) {
        console.error('❌ Backend fallback also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  async buildSwapTransaction(sourceAccount, sendAsset, sendAmount, destination, destAsset, destMin, path = []) {
    try {
      if (this.stellarSdk) {
        // Client-side swap transaction building
        console.log('🔧 Building swap transaction client-side...');
        
        const account = await this.server.loadAccount(sourceAccount);
        
        const transaction = new this.stellarSdk.TransactionBuilder(account, {
          fee: this.stellarSdk.BASE_FEE,
          networkPassphrase: this.stellarSdk.Networks.PUBLIC
        })
        .addOperation(this.stellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: sendAsset === 'XLM' ? this.stellarSdk.Asset.native() : 
                    new this.stellarSdk.Asset(sendAsset.code, sendAsset.issuer),
          sendAmount: sendAmount.toString(),
          destination: destination,
          destAsset: destAsset === 'XLM' ? this.stellarSdk.Asset.native() : 
                    new this.stellarSdk.Asset(destAsset.code, destAsset.issuer),
          destMin: destMin.toString(),
          path: path.map(asset => 
            asset === 'XLM' ? this.stellarSdk.Asset.native() : 
            new this.stellarSdk.Asset(asset.code, asset.issuer)
          )
        }))
        .setTimeout(30);
        
        const builtTransaction = transaction.build();
        const xdr = builtTransaction.toXDR();
        
        console.log('✅ Swap transaction built client-side');
        return { xdr, source: 'client' };
        
      } else {
        // Backend swap transaction building
        console.log('🔄 Using backend for swap transaction building...');
        
        const response = await fetch('/mini-app/build-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourcePublicKey: sourceAccount,
            transactionData: {
              sendAsset: sendAsset,
              sendAmount: sendAmount,
              destination: destination,
              destAsset: destAsset,
              destMin: destMin,
              path: path
            },
            operationType: 'pathPaymentStrictSend'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Backend swap transaction building failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Swap transaction built by backend');
        return { xdr: result.xdr, source: 'server' };
      }
      
    } catch (error) {
      console.error('❌ Swap transaction building failed:', error);
      throw error;
    }
  }
}

// Factory functions
function createSecureTransactionStamper(privateKey, publicKey) {
  console.log('🔐 Creating SecureTransactionStamper for high-security operations');
  return new SecureTransactionStamper(privateKey, publicKey);
}

function createSessionTransactionStamper() {
  console.log('🤖 Creating SessionTransactionStamper for automated operations');
  return new SessionTransactionStamper();
}

function createStellarTransactionBuilder() {
  console.log('✅ Creating StellarTransactionBuilder');
  return new StellarTransactionBuilder();
}

// Export for use in other modules
window.SecureTransactionStamper = SecureTransactionStamper;
window.SessionTransactionStamper = SessionTransactionStamper;
window.StellarTransactionBuilder = StellarTransactionBuilder;
window.createSecureTransactionStamper = createSecureTransactionStamper;
window.createSessionTransactionStamper = createSessionTransactionStamper;
window.createStellarTransactionBuilder = createStellarTransactionBuilder;

// Legacy compatibility
window.StellarTransactionStamper = SecureTransactionStamper;
window.TransactionStamper = SecureTransactionStamper;
window.createTransactionStamper = createSecureTransactionStamper;
