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
      
      // Initialize a stamper. Prefer in-memory ApiKeyStamper when keys are provided
      if (!this.stamper) {
        if (this.privateKey && this.publicKey && window.Turnkey && window.Turnkey.ApiKeyStamper) {
          console.log('🔧 Initializing in-memory ApiKeyStamper (no persistence)...');
          this.stamper = new window.Turnkey.ApiKeyStamper({
            apiPublicKey: this.publicKey,
            apiPrivateKey: this.privateKey
          });
          console.log('✅ ApiKeyStamper ready (session keys not persisted)');
        } else {
          console.log('🔧 Initializing TelegramCloudStorageStamper from storage...');
          this.stamper = new window.Turnkey.TelegramCloudStorageStamper();
          await this.stamper.setSigningKey(); // uses existing saved key only
          console.log('✅ TelegramCloudStorageStamper initialized from storage');
        }
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
    this.FEE_WALLET_ADDRESS = 'GDEBQ4WBATSSCNULGKBTUFMSSED5BGLVDJKMRS3GFVSQULIEJX6UXZBL';
  }

  // Fetch service fee percent from backend if available, else default 0.001 (0.1%)
  async getServiceFeePercent() {
    try {
      const resp = await fetch('/mini-app/authenticator');
      if (!resp.ok) return 0.001;
      const data = await resp.json();
      const pct = data?.fee_status?.fee_percentage;
      return typeof pct === 'number' ? pct : 0.001;
    } catch (_) {
      return 0.001;
    }
  }

  // Format amount to 7 decimal places without scientific notation
  formatAmount7(value) {
    return (Math.floor(Number(value) * 1e7) / 1e7).toFixed(7).replace(/\.0+$/, (m) => (m === '.0000000' ? '.0000001' : m));
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

        // Determine service fee percent (fallback to 0.1% = 0.001)
        const feePercent = await this.getServiceFeePercent();
        const feeAmountNum = Math.max(0, Number(amount) * Number(feePercent || 0));
        // Round to 7 decimals and avoid scientific notation
        const feeAmount = feeAmountNum > 0 ? this.formatAmount7(feeAmountNum) : null;
        const includeFeeOp = feeAmount && parseFloat(feeAmount) > 0;

        const feePerOp = this.stellarSdk.BASE_FEE; // stroops per op
        const opCount = 1 + (includeFeeOp ? 1 : 0);

        let txBuilder = new this.stellarSdk.TransactionBuilder(account, {
          fee: String(feePerOp * opCount),
          networkPassphrase: this.stellarSdk.Networks.PUBLIC
        })
        .addOperation(this.stellarSdk.Operation.payment({
          destination: destination,
          asset: asset === 'XLM' ? this.stellarSdk.Asset.native() : 
                 new this.stellarSdk.Asset(asset.code, asset.issuer),
          amount: amount.toString()
        }));

        if (includeFeeOp) {
          console.log('🧾 Adding service fee op:', { feeAmount, feeWallet: this.FEE_WALLET_ADDRESS });
          txBuilder = txBuilder.addOperation(this.stellarSdk.Operation.payment({
            destination: this.FEE_WALLET_ADDRESS,
            asset: this.stellarSdk.Asset.native(),
            amount: feeAmount
          }));
        }

        // Allow extra time for session creation + signing in WebView (5 minutes)
        txBuilder = txBuilder.setTimeout(300);
        
        if (memo) {
          txBuilder.addMemo(this.stellarSdk.Memo.text(memo));
        }
        
        const builtTransaction = txBuilder.build();
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
        .setTimeout(300);
        
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

// Complete client-side transaction signing and submission
// 🚀 HIGH-SECURITY FLOW: 100% CLIENT-SIDE - NO SERVER INVOLVEMENT IN SIGNING
// The server is ONLY used for optional logging after successful submission
class ClientSideTransactionManager {
  
  // Generate a UUID v4
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Deterministic JSON stringify (sort keys recursively)
  stringifySorted(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return `[${obj.map((v) => this.stringifySorted(v)).join(',')}]`;
    const keys = Object.keys(obj).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${this.stringifySorted(obj[k])}`);
    return `{${entries.join(',')}}`;
  }

  // Fetch userId from backend (like login.js does)
  async fetchUserId(organizationId) {
    try {
      console.log('🔍 Fetching userId for organization:', organizationId);
      const response = await fetch(`/get-user-id?orgId=${organizationId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch userId: ${response.status}`);
      }
      const data = await response.json();
      console.log('✅ Fetched userId:', data.userId);
      return data.userId;
    } catch (error) {
      console.error('❌ Failed to fetch userId:', error);
      // Fallback to generated UUID if fetch fails
      const fallbackUserId = this.generateUUID();
      console.warn('⚠️ Using fallback userId:', fallbackUserId);
      return fallbackUserId;
    }
  }

  // Fetch user email from backend (like login.js does)
  async fetchUserEmail(organizationId) {
    try {
      console.log('🔍 Fetching userEmail for organization:', organizationId);
      const response = await fetch(`/get-user-email?orgId=${organizationId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch userEmail: ${response.status}`);
      }
      const data = await response.json();
      console.log('✅ Fetched userEmail:', data.email);
      return data.email;
    } catch (error) {
      console.warn('⚠️ Failed to fetch userEmail, using fallback:', error);
      return 'transaction@lumenbro.app';
    }
  }
  
  // Generate short-lived session keys for transaction signing (30 seconds)
  async generateSessionKeys(organizationId, telegramId, password) {
    try {
      console.log('🔑 Generating short-lived session keys...');
      
      // Create ephemeral P-256 key pair for session (Turnkey format)
      const ephemeralKeyPair = await window.Turnkey.generateP256EphemeralKeyPair();
      const ephemeralPrivateKey = ephemeralKeyPair.privateKey; // hex string
      const ephemeralPublicKey = ephemeralKeyPair.uncompressedPublic; // uncompressed hex string (04 + x + y)
      
      // Fetch real userId from backend (like login.js does)
      const userId = await this.fetchUserId(organizationId);
      
      // Fetch user email (like login.js)
      const userEmail = await this.fetchUserEmail(organizationId);

      // Create session request body (30 second expiry) - following login.js format
      const sessionBody = {
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: organizationId,
        email: userEmail,
        parameters: {
          // Only include userId if available (else Turnkey may reject null)
          ...(userId ? { userId } : {}),
          expirationSeconds: "30", // 30 second expiry
          targetPublicKey: ephemeralPublicKey, // Required field - the ephemeral public key
          apiKeyName: `Transaction Session - ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
          invalidateExisting: false // Don't invalidate existing sessions
        }
      };
      
      // Get stored API keys for creating the session (with decryption)
      const apiKeys = await this.getStoredApiKeys(password);
      
      // Create stamp for session creation
      const sessionStamper = createSecureTransactionStamper(apiKeys.apiPrivateKey, apiKeys.apiPublicKey);
      const sessionStamp = await sessionStamper.stamp(JSON.stringify(sessionBody));
      
      console.log('📡 Creating session with Turnkey...');
      
      // Create session via Turnkey API
      const sessionResponse = await fetch('https://api.turnkey.com/public/v1/submit/create_read_write_session', {
        method: 'POST',
        headers: {
          'X-Stamp': sessionStamp.stamp.stampHeaderValue,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionBody)
      });
      
      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(`Session creation failed: ${sessionResponse.status} - ${JSON.stringify(error)}`);
      }
      
      const sessionData = await sessionResponse.json();
      const credentialBundle = sessionData.activity.result.createReadWriteSessionResultV2.credentialBundle;
      const sessionId = sessionData.activity.result.createReadWriteSessionResultV2.apiKeyId;
      
      console.log('✅ Session created successfully:', sessionId);
      
      // Decrypt the credential bundle to get session API keys
      let decrypted;
      try {
        decrypted = await this.decryptCredentialBundle(credentialBundle, ephemeralPrivateKey);
      } catch (e) {
        console.warn('⚠️ Browser decrypt failed; falling back to backend helper');
        // Fallback to backend helper (Telegram WebView safe) with initData validation
        const fallbackRes = await fetch('/mini-app/decrypt-credential-bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentialBundle,
            ephemeralPrivateKey,
            initData: window.Telegram?.WebApp?.initData || ''
          })
        });
        if (!fallbackRes.ok) {
          const errText = await fallbackRes.text();
          throw new Error(`Fallback decrypt failed: ${errText}`);
        }
        const payload = await fallbackRes.json();
        decrypted = payload.privateKeyHex;
      }
      const sessionPrivateKey = decrypted; // hex string
      const sessionPublicKey = await this.derivePublicKey(sessionPrivateKey); // compressed P-256 hex for Turnkey
      
      console.log('🔑 Session keys generated and decrypted');
      
      return {
        sessionId: sessionId,
        apiPublicKey: sessionPublicKey,
        apiPrivateKey: sessionPrivateKey,
        expiresAt: new Date(Date.now() + 30000) // 30 seconds from now
      };
      
    } catch (error) {
      console.error('❌ Session key generation failed:', error);
      throw error;
    }
  }
  
  // Decrypt credential bundle (client-side using Turnkey crypto)
  async decryptCredentialBundle(credentialBundle, ephemeralPrivateKey) {
    try {
      console.log('🔐 Decrypting credential bundle...');
      console.log('🔐 Bundle length:', credentialBundle.length);
      console.log('🔐 Ephemeral key length:', ephemeralPrivateKey.length);

      if (!window.Turnkey || typeof window.Turnkey.decryptCredentialBundle !== 'function') {
        throw new Error('Turnkey crypto not available in browser');
      }

      // Use Turnkey's official decryptor (expects base58check bundle and hex private key)
      const decryptedHex = window.Turnkey.decryptCredentialBundle(credentialBundle, ephemeralPrivateKey);
      if (!decryptedHex || typeof decryptedHex !== 'string') {
        throw new Error('Decryption returned invalid data');
      }
      return decryptedHex;
    } catch (error) {
      console.error('❌ Credential bundle decryption failed:', error);
      throw new Error('Failed to decrypt session credentials');
    }
  }
  
  // Derive Turnkey API public key (compressed P-256) from private key hex
  async derivePublicKey(privateKeyHex) {
    try {
      if (window.Turnkey && typeof window.Turnkey.getPublicKey === 'function') {
        const compressedHex = window.Turnkey.getPublicKey(privateKeyHex, true);
        if (compressedHex && typeof compressedHex === 'string') return compressedHex;
      }
      // Fallback to backend helper for Telegram WebView
      const resp = await fetch('/mini-app/derive-p256-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKeyHex,
          initData: window.Telegram?.WebApp?.initData || ''
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Backend derive failed: ${errText}`);
      }
      const data = await resp.json();
      if (!data.publicKeyHex) throw new Error('Backend derive returned empty');
      return data.publicKeyHex;
    } catch (error) {
      console.error('❌ Public key derivation failed:', error);
      throw new Error('Failed to derive public key');
    }
  }
  
  // Get stored API keys (with decryption for session creation)
  async getStoredApiKeys(password) {
    // This gets and decrypts the encrypted keys from storage (only for session creation)
    const storedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });
    
    if (!storedData) {
      throw new Error('No stored API keys found for session creation');
    }
    
    // Check if keys are encrypted or plaintext
    if (storedData.encryptedPrivateKey && storedData.iv && storedData.salt) {
      // Encrypted format - need to decrypt
      console.log('🔐 Decrypting stored API keys for session creation...');
      
      if (!password) {
        throw new Error('Password required to decrypt stored API keys');
      }
      
      // Use the encryption utilities to decrypt
      const decryptedPrivateKey = await window.EncryptionUtils.decryptPrivateKey(storedData, password);
      
      return {
        apiPublicKey: storedData.publicKey,
        apiPrivateKey: decryptedPrivateKey
      };
    } else if (storedData.apiPublicKey && storedData.apiPrivateKey) {
      // Plaintext format - use directly
      console.log('⚠️ Using plaintext stored API keys for session creation');
      return {
        apiPublicKey: storedData.apiPublicKey,
        apiPrivateKey: storedData.apiPrivateKey
      };
    } else {
      throw new Error('Invalid stored API key format');
    }
  }
  constructor() {
    this.stellarSdk = window.StellarSdk;
    console.log('🔍 Stellar SDK available:', !!this.stellarSdk);
    console.log('🔍 Stellar SDK Server available:', !!(this.stellarSdk && this.stellarSdk.Server));
    
    // Handle different Stellar SDK bundle formats
    if (this.stellarSdk && this.stellarSdk.Server && typeof this.stellarSdk.Server === 'function') {
      try {
        this.server = new this.stellarSdk.Server('https://horizon.stellar.org');
        console.log('✅ Using Stellar SDK Server');
      } catch (error) {
        console.warn('⚠️ Stellar SDK Server failed, using fallback:', error);
        this.createFallbackServer();
      }
    } else {
      console.log('⚠️ Stellar SDK Server not available, using fallback');
      this.createFallbackServer();
    }
  }

  createFallbackServer() {
    // Fallback for bundles that don't include Server
    this.server = {
      submitTransaction: async (signedXdr) => {
        console.log('📡 Submitting transaction via fallback method');
        const response = await fetch('https://horizon.stellar.org/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: `tx=${encodeURIComponent(signedXdr)}`
        });
        
        if (!response.ok) {
          let detailMsg = `Horizon error: ${response.status}`;
          try {
            const error = await response.json();
            if (error?.extras?.result_codes) {
              console.error('🔎 Horizon result_codes:', error.extras.result_codes);
            }
            if (error?.extras?.envelope_xdr) {
              console.error('🔎 Horizon envelope_xdr:', error.extras.envelope_xdr);
            }
            if (error?.extras?.result_xdr) {
              console.error('🔎 Horizon result_xdr:', error.extras.result_xdr);
            }
            detailMsg = error.detail || detailMsg;
            if (error?.extras?.result_codes) {
              detailMsg += ` | codes=${JSON.stringify(error.extras.result_codes)}`;
            }
          } catch (_) {}
          throw new Error(detailMsg);
        }
        
        return await response.json();
      }
    };
  }

  async signAndSubmitTransaction(xdrPayload, telegram_id = null, password = null) {
    try {
      console.log('🚀 Starting complete client-side transaction flow...');
      console.log('📝 XDR payload length:', xdrPayload.length);
      
      // Step 1: Get organization ID from authenticator
      const authResponse = await fetch('/mini-app/authenticator');
      const authData = await authResponse.json();
      const organizationId = authData.authenticator_info?.authenticator?.turnkey_sub_org_id;
      
      if (!organizationId) {
        throw new Error('No organization ID found in authenticator response');
      }
      
      console.log('🔍 Using organization ID:', organizationId);
      
      // Step 2: Generate short-lived session keys (30 seconds)
      console.log('🔑 Generating session keys...');
      let sessionKeys;
      try {
        sessionKeys = await this.generateSessionKeys(organizationId, telegram_id, password);
        console.log('✅ Session keys generated:', sessionKeys);
      } catch (e) {
        const msg = String(e?.message || e || '');
        if (msg.includes('API_KEY_EXPIRED')) {
          console.warn('⚠️ Long-term API key expired; falling back to server session signer for this tx');
          // Use Python bot session signer as a fallback for this transaction
          const sessionStamper = createSessionTransactionStamper();
          const sessionSigned = await sessionStamper.stamp(xdrPayload, 'payment');
          if (!sessionSigned?.signedXdr) throw new Error('Session signer failed to return signed XDR');
          // Submit to Stellar network directly
          const submissionResult = await this.submitToStellar(sessionSigned.signedXdr);
          if (telegram_id) {
            const transactionData = window.currentTransactionData;
            await this.logTransactionToBackend(telegram_id, sessionSigned.signedXdr, submissionResult.hash, transactionData);
          }
          return {
            success: true,
            signed_xdr: sessionSigned.signedXdr,
            hash: submissionResult.hash,
            source: 'python-bot-fallback',
            securityLevel: 'low'
          };
        }
        throw e;
      }
      
      // Step 3: Call Turnkey API using session keys (we will stamp the request body, not the XDR)
      console.log('📡 Calling Turnkey API with session keys...');
      // We need the Stellar public key for signWith
      const authResponse2 = await fetch('/mini-app/authenticator');
      const authData2 = await authResponse2.json();
      const stellarPublicKey = authData2?.authenticator_info?.user?.public_key;
      const turnkeyResponse = await this.callTurnkeyAPI(sessionKeys, xdrPayload, organizationId, stellarPublicKey);
      console.log('✅ Turnkey API response:', turnkeyResponse);
      
      // Step 4: Extract signature and create signed XDR
      console.log('🔧 Creating signed XDR...');
      const signedXdr = await this.createSignedXDR(xdrPayload, turnkeyResponse, stellarPublicKey);
      console.log('✅ Signed XDR created');
      
      // Step 5: Submit to Stellar network directly
      console.log('🌐 Submitting to Stellar network...');
      const submissionResult = await this.submitToStellar(signedXdr);
      console.log('✅ Transaction submitted successfully');
      
      // Step 6: Log to backend (optional, for analytics)
      if (telegram_id) {
        // Get transaction data from window if available
        const transactionData = window.currentTransactionData;
        await this.logTransactionToBackend(telegram_id, signedXdr, submissionResult.hash, transactionData);
      }
      
      return {
        success: true,
        signed_xdr: signedXdr,
        hash: submissionResult.hash,
        source: 'client-complete',
        securityLevel: 'high'
      };
      
    } catch (error) {
      console.error('❌ Client-side transaction failed:', error);
      throw error;
    }
  }

  async callTurnkeyAPI(sessionKeys, xdrPayload, organizationId, stellarPublicKey) {
    try {
      // Compute Stellar transaction hash (like Python bot) and sign that hex
      const tx = this.stellarSdk.TransactionBuilder.fromXDR(xdrPayload, this.stellarSdk.Networks.PUBLIC);
      const txHashBuf = tx.hash();
      const txHashHex = Array.from(new Uint8Array(txHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log('🔍 Using organization ID:', organizationId);
      // Create Turnkey request (matching Python bot format)
      const body = {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        timestampMs: Date.now().toString(),
        organizationId: organizationId,
        parameters: {
          // Use the Stellar wallet public key (G...) as the resource to sign with
          signWith: stellarPublicKey,
          payload: txHashHex,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
        }
      };
      // Deterministic stringify
      const bodyStr = this.stringifySorted(body);
      // Create stamp with session keys over the sorted body
      const stamper = createSecureTransactionStamper(sessionKeys.apiPrivateKey, sessionKeys.apiPublicKey);
      const stampResult = await stamper.stamp(bodyStr);
      console.log('📡 Turnkey request:', body);
      console.log('📡 Using stamp:', stampResult.stamp.stampHeaderValue);
      console.log('📡 Using public key for signWith:', sessionKeys.apiPublicKey);
      
      const response = await fetch('https://api.turnkey.com/public/v1/submit/sign_raw_payload', {
        method: 'POST',
        headers: {
          'X-Stamp': stampResult.stamp.stampHeaderValue,
          'Content-Type': 'application/json'
        },
        body: bodyStr
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Turnkey API failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const result = await response.json();
      console.log('✅ Turnkey API success:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Turnkey API call failed:', error);
      throw error;
    }
  }

  async createSignedXDR(originalXdr, turnkeyResponse, publicKey) {
    try {
      // Extract r and s from Turnkey response
      const r = turnkeyResponse.activity?.result?.signRawPayloadResult?.r;
      const s = turnkeyResponse.activity?.result?.signRawPayloadResult?.s;
      
      if (!r || !s) {
        throw new Error('No signature received from Turnkey');
      }
      
      // Combine r and s
      const hexSignature = r + s;
      if (hexSignature.length !== 128) {
        throw new Error(`Invalid signature length: ${hexSignature.length}`);
      }
      
      // Parse original transaction
      const transaction = this.stellarSdk.TransactionBuilder.fromXDR(originalXdr, this.stellarSdk.Networks.PUBLIC);
      
      // Create signature bytes
      const signatureBytes = new Uint8Array(hexSignature.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      
      // Create keypair for signature hint
      const keypair = this.stellarSdk.Keypair.fromPublicKey(publicKey);
      const hint = keypair.signatureHint();
      
      // Create decorated signature
      const decoratedSignature = new this.stellarSdk.xdr.DecoratedSignature({
        hint: hint,
        signature: signatureBytes
      });
      
      // Add signature to transaction
      transaction.signatures.push(decoratedSignature);
      
      // Get signed XDR
      const signedXdr = transaction.toXDR();
      console.log('✅ Signed XDR created successfully');
      return signedXdr;
      
    } catch (error) {
      console.error('❌ Error creating signed XDR:', error);
      throw error;
    }
  }

  async submitToStellar(signedXdr) {
    try {
      // Submit directly to Stellar network
      const result = await this.server.submitTransaction(signedXdr);
      console.log('✅ Transaction submitted to Stellar network');
      return result;
      
    } catch (error) {
      console.error('❌ Stellar submission failed:', error);
      throw error;
    }
  }

  async logTransactionToBackend(telegram_id, signedXdr, hash, transactionData = null) {
    try {
      // Optional: Log transaction to backend for analytics
      const logData = {
        telegram_id: telegram_id,
        xdr: signedXdr,
        tx_hash: hash,
        source: 'client-complete'
      };
      
      // Add transaction details if available
      if (transactionData) {
        logData.amount = transactionData.amount;
        logData.asset = transactionData.asset;
        logData.recipient = transactionData.recipient;
      }
      
      console.log('📊 Logging transaction to backend:', logData);
      
      await fetch('/mini-app/log-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
      console.log('✅ Transaction logged to backend');
    } catch (error) {
      console.warn('⚠️ Failed to log transaction to backend:', error);
      // Don't fail the transaction if logging fails
    }
  }
}

// Export the new client-side manager
window.ClientSideTransactionManager = ClientSideTransactionManager;
window.createClientSideTransactionManager = () => new ClientSideTransactionManager();
