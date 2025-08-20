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

// Complete client-side transaction signing and submission
// 🚀 HIGH-SECURITY FLOW: 100% CLIENT-SIDE - NO SERVER INVOLVEMENT IN SIGNING
// The server is ONLY used for optional logging after successful submission
class ClientSideTransactionManager {
  
  // Generate short-lived session keys for transaction signing (30 seconds)
  async generateSessionKeys(organizationId, telegramId) {
    try {
      console.log('🔑 Generating short-lived session keys...');
      
      // Create ephemeral key pair for session
      const ephemeralKeyPair = this.stellarSdk.Keypair.random();
      const ephemeralPrivateKey = ephemeralKeyPair.secret();
      const ephemeralPublicKey = ephemeralKeyPair.publicKey();
      
      // Create session request body (30 second expiry)
      const sessionBody = {
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: organizationId,
        parameters: {
          expirationSeconds: "30", // 30 second expiry
          allowedOperations: ["SIGN_RAW_PAYLOAD"]
        }
      };
      
      // Get stored API keys for creating the session
      const apiKeys = await this.getStoredApiKeys();
      
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
      const decrypted = this.decryptCredentialBundle(credentialBundle, ephemeralPrivateKey);
      const sessionPrivateKey = decrypted;
      const sessionPublicKey = this.derivePublicKey(sessionPrivateKey);
      
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
  
  // Decrypt credential bundle (client-side version)
  decryptCredentialBundle(credentialBundle, ephemeralPrivateKey) {
    // This is a simplified version - in production you'd use the full Turnkey crypto library
    // For now, we'll use a basic decryption approach
    try {
      // Convert hex strings to buffers
      const bundleBuffer = Buffer.from(credentialBundle, 'base64');
      const ephemeralBuffer = Buffer.from(ephemeralPrivateKey, 'hex');
      
      // Simple XOR decryption (this is just for demo - use proper crypto in production)
      const decrypted = Buffer.alloc(bundleBuffer.length);
      for (let i = 0; i < bundleBuffer.length; i++) {
        decrypted[i] = bundleBuffer[i] ^ ephemeralBuffer[i % ephemeralBuffer.length];
      }
      
      return decrypted.toString('hex');
    } catch (error) {
      console.error('❌ Credential bundle decryption failed:', error);
      throw new Error('Failed to decrypt session credentials');
    }
  }
  
  // Derive public key from private key
  derivePublicKey(privateKeyHex) {
    try {
      // Use Stellar SDK to derive public key
      const keypair = this.stellarSdk.Keypair.fromSecret(privateKeyHex);
      return keypair.publicKey();
    } catch (error) {
      console.error('❌ Public key derivation failed:', error);
      throw new Error('Failed to derive public key');
    }
  }
  
  // Get stored API keys (without decryption - just for session creation)
  async getStoredApiKeys() {
    // This gets the plaintext keys from storage (only for session creation)
    const storedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });
    
    if (!storedData || !storedData.apiPublicKey || !storedData.apiPrivateKey) {
      throw new Error('No stored API keys found for session creation');
    }
    
    return {
      apiPublicKey: storedData.apiPublicKey,
      apiPrivateKey: storedData.apiPrivateKey
    };
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx: signedXdr })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || `Horizon error: ${response.status}`);
        }
        
        return await response.json();
      }
    };
  }

  async signAndSubmitTransaction(xdrPayload, telegram_id = null) {
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
      const sessionKeys = await this.generateSessionKeys(organizationId, telegram_id);
      console.log('✅ Session keys generated:', sessionKeys);
      
      // Step 3: Create stamp using session keys
      console.log('🔐 Creating Turnkey stamp with session keys...');
      const stamper = createSecureTransactionStamper(sessionKeys.apiPrivateKey, sessionKeys.apiPublicKey);
      const stampResult = await stamper.stamp(xdrPayload);
      console.log('✅ Stamp created:', stampResult);
      
      // Step 4: Call Turnkey API with session keys
      console.log('📡 Calling Turnkey API with session keys...');
      const turnkeyResponse = await this.callTurnkeyAPI(stampResult, xdrPayload, organizationId);
      console.log('✅ Turnkey API response:', turnkeyResponse);
      
      // Step 4: Extract signature and create signed XDR
      console.log('🔧 Creating signed XDR...');
      const signedXdr = await this.createSignedXDR(xdrPayload, turnkeyResponse, publicKey);
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

  async callTurnkeyAPI(stampResult, xdrPayload, organizationId) {
    try {
      // Convert base64 payload to hex (like Python bot)
      const payloadBuffer = new Uint8Array(atob(xdrPayload).split('').map(c => c.charCodeAt(0)));
      const payloadHex = Array.from(payloadBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log('🔍 Using organization ID:', organizationId);
      
      // Check if we should use session keys instead of stored keys
      // The Python bot uses session keys for signing
      const sessionKeys = authData.authenticator_info?.authenticator?.session_keys;
      if (sessionKeys) {
        console.log('🔍 Found session keys in authenticator, should use those for signing');
        console.log('🔍 Session keys:', sessionKeys);
        // TODO: We might need to use session keys instead of stored keys
        // This would require a different approach since session keys are server-side
      }
      
      // Create Turnkey request (matching Python bot format)
      const turnkeyRequest = {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        timestampMs: Date.now().toString(),
        organizationId: organizationId,
        parameters: {
          signWith: stampResult.publicKey,
          payload: payloadHex,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
        }
      };
      
      console.log('📡 Turnkey request:', turnkeyRequest);
      console.log('📡 Using stamp:', stampResult.stamp.stampHeaderValue);
      console.log('📡 Using public key for signWith:', stampResult.publicKey);
      
      const response = await fetch('https://api.turnkey.com/public/v1/submit/sign_raw_payload', {
        method: 'POST',
        headers: {
          'X-Stamp': stampResult.stamp.stampHeaderValue,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(turnkeyRequest)
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
