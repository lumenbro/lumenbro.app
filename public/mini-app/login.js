// public/mini-app/login.js - Client-side login
// Use global params from index.html – no local const

// Helper functions
function hexToUint8Array(hex) {
  if (!hex) throw new Error('Hex string is undefined or empty');
  
  // Mobile-compatible hex to Uint8Array conversion
  try {
    // Remove any '0x' prefix
    const cleanHex = hex.replace(/^0x/, '');
    
    // Ensure even length
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    
    // Split into pairs and convert
    const pairs = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      pairs.push(cleanHex.substr(i, 2));
    }
    
    return new Uint8Array(pairs.map(byte => parseInt(byte, 16)));
  } catch (error) {
    console.error('❌ hexToUint8Array error:', error);
    console.error('Input hex:', hex);
    throw new Error(`Hex conversion failed: ${error.message}`);
  }
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function stringifySorted(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }
  return '{' + Object.keys(obj).sort().map(key => {
    return JSON.stringify(key) + ':' + stringifySorted(obj[key]);
  }).join(',') + '}';
}

function bytesToBase64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}



// Convert compressed public key to uncompressed format
async function convertCompressedToUncompressed(compressedHex) {
  try {
    console.log('🔍 Converting compressed to uncompressed public key...');
    console.log('Compressed hex:', compressedHex);
    
    // Remove '0x' prefix if present
    const cleanHex = compressedHex.replace(/^0x/, '');
    
    // Check if it's already uncompressed (starts with '04')
    if (cleanHex.startsWith('04')) {
      console.log('✅ Already uncompressed format');
      return cleanHex;
    }
    
    // Check if it's compressed (starts with '02' or '03')
    if (!cleanHex.startsWith('02') && !cleanHex.startsWith('03')) {
      throw new Error('Invalid public key format - must start with 02, 03, or 04');
    }
    
    // For mobile compatibility, we'll use a different approach
    // Instead of trying to convert the compressed key, we'll derive the public key
    // from the private key using Web Crypto API
    
    console.log('⚠️ Using private key derivation for mobile compatibility');
    
    // We'll handle this in the importPrivateKey function by deriving the public key
    // from the private key instead of using the provided compressed key
    throw new Error('Use private key derivation instead');
    
  } catch (error) {
    console.error('❌ convertCompressedToUncompressed failed:', error);
    throw error;
  }
}

async function importPrivateKey(privateHex, publicCompressedHex) {
  try {
    console.log('🔍 Importing private key...');
    console.log('Private hex length:', privateHex?.length);
    console.log('Public hex length:', publicCompressedHex?.length);
    
    // Mobile-compatible approach - use simplified JWK import
    if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
      console.log('🔧 Using mobile-compatible simplified JWK import...');
      
      const privateBytes = hexToUint8Array(privateHex);
      console.log('✅ Private bytes converted, length:', privateBytes.length);
      
      // Convert private key to base64url
      const d = bytesToBase64url(privateBytes);
      console.log('✅ Private key base64url encoded');
      
      // Create a simple JWK with just the private key (no public key components)
      const privateJwk = {
        kty: "EC",
        crv: "P-256",
        d: d
      };
      console.log('✅ Private JWK created (mobile-compatible)');

      const result = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
      );
      console.log('✅ Private key imported successfully (mobile-compatible)');
      return result;
    }
    
    // Desktop approach - use JWK import
    console.log('🔍 Using JWK import approach...');
    
    const privateBytes = hexToUint8Array(privateHex);
    console.log('✅ Private bytes converted, length:', privateBytes.length);
    
    // Convert private key to base64url
    const d = bytesToBase64url(privateBytes);
    console.log('✅ Private key base64url encoded');
    
    // Create a simple JWK with just the private key
    const privateJwk = {
      kty: "EC",
      crv: "P-256",
      d: d
    };
    console.log('✅ Private JWK created');

    const result = await crypto.subtle.importKey(
      "jwk",
      privateJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"]
    );
    console.log('✅ Private key imported successfully');
    return result;
  } catch (error) {
    console.error('❌ importPrivateKey failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      line: error.line,
      column: error.column
    });
    
    // Mobile-specific error handling
    if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
      console.error('🔍 This is a mobile-specific error in importPrivateKey');
      console.error('Possible causes:');
      console.error('- Web Crypto API limitations on mobile');
      console.error('- Key format issues');
      console.error('- Memory constraints');
      console.error('- JWK import restrictions on mobile');
    }
    
    throw error;
  }
}

function derEncodeSignature(sigBuffer) {
  const sigBytes = new Uint8Array(sigBuffer);
  const rBytes = sigBytes.slice(0, 32);
  let s = BigInt('0x' + arrayBufferToHex(sigBytes.slice(32)));
  const n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  if (s > n / 2n) {
    s = n - s;
  }
  const sHex = s.toString(16).padStart(64, '0');
  const sBytes = hexToUint8Array(sHex);

  let r = [...rBytes];
  let sArr = [...sBytes];
  if (r[0] > 127) r = [0, ...r];
  if (sArr[0] > 127) sArr = [0, ...sArr];

  const rLen = r.length;
  const sLen = sArr.length;
  const totalLen = 2 + rLen + 2 + sLen;
  const der = new Uint8Array(2 + totalLen);
  der[0] = 0x30;
  der[1] = totalLen;
  der[2] = 0x02;
  der[3] = rLen;
  der.set(r, 4);
  der[4 + rLen] = 0x02;
  der[5 + rLen] = sLen;
  der.set(sArr, 6 + rLen);
  return arrayBufferToHex(der);
}

// Manual stamper implementation using our encrypted key storage
// Now uses Turnkey's ApiKeyStamper internally for better mobile compatibility
class ManualStamper {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  async stamp(payload) {
    try {
      console.log('🔍 Starting manual stamping process...');
      
      // Use Turnkey's ApiKeyStamper internally for better mobile compatibility
      // This gives us the same fallback logic as TelegramCloudStorageStamper
      const apiKeyStamper = new window.Turnkey.ApiKeyStamper({
        apiPublicKey: this.publicKey,
        apiPrivateKey: this.privateKey
      });
      
      console.log('✅ Using Turnkey ApiKeyStamper with fallback support');
      
      // The ApiKeyStamper will automatically handle:
      // - Web Crypto API on desktop
      // - Pure JS fallback on mobile
      // - All the complex key import logic
      const stampResult = await apiKeyStamper.stamp(payload);
      
      console.log('✅ ApiKeyStamper signing successful');
      
      // ApiKeyStamper returns { stampHeaderName, stampHeaderValue }
      // We need to extract the signature from stampHeaderValue
      const stampData = JSON.parse(atob(stampResult.stampHeaderValue.replace(/-/g, '+').replace(/_/g, '/')));
      
      return {
        publicKey: stampData.publicKey,
        scheme: stampData.scheme,
        signature: stampData.signature
      };

    } catch (error) {
      console.error('❌ ManualStamper.stamp failed:', error);
      
      // Fallback to backend signing if ApiKeyStamper fails
      console.log('🔄 Attempting backend signing as fallback...');
      
      try {
        const response = await fetch('/mini-app/sign-payload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: payload,
            privateKey: this.privateKey,
            publicKey: this.publicKey
          })
        });
        
        if (!response.ok) {
          throw new Error(`Backend signing failed: ${response.status}`);
        }
        
        const stampResult = await response.json();
        console.log('✅ Backend signing successful as fallback');
        
        // Store the correct sub-org ID for use in the login process
        if (stampResult.subOrgId) {
          window.correctSubOrgId = stampResult.subOrgId;
          console.log('🔧 Using correct sub-org ID:', stampResult.subOrgId);
        }
        
        return {
          publicKey: stampResult.publicKey || this.publicKey,
          scheme: "SIGNATURE_SCHEME_TK_API_P256",
          signature: stampResult.signature
        };
        
      } catch (backendError) {
        console.error('❌ Backend signing also failed:', backendError);
        throw new Error('Signing failed - please try again');
      }
    }
  }
}

function createManualStamper(privateKey, publicKey) {
  console.log('✅ Creating ManualStamper with encrypted keys');
  return new ManualStamper(privateKey, publicKey);
}

async function login() {
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get('orgId');
  const email = urlParams.get('email');
  const telegramId = urlParams.get('telegram_id');

  if (!orgId) {
    document.getElementById('content').innerHTML = 'Error: Missing orgId parameter';
    return;
  }

  // Enhanced mobile error handling
  if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
    console.log('🔧 Mobile login detected - applying enhanced error handling');
  }

  try {
    // Check if key is in encrypted format first
    const isEncrypted = await window.EncryptionUtils.isKeyEncrypted();
    
    let apiKey;
    let password; // Store password to avoid asking twice
    
    if (isEncrypted) {
      // Use standardized decryption
      console.log('Using encrypted key format');
      
             // Always use the input field approach (works on both mobile and desktop)
       console.log('🔧 Using input field approach...');
       
       // Show a simple password input (like export does)
       document.getElementById('content').innerHTML = `
         <div class="login-card">
           <h3>🔐 Enter Password</h3>
           <p>Enter your password to decrypt your API keys:</p>
           <input type="password" id="loginPassword" placeholder="Enter password" class="login-input" autocomplete="current-password">
           <button onclick="submitLogin()" class="btn-primary login-button">
             Continue Login
           </button>
         </div>
       `;
       
       // Define the submit function
       window.submitLogin = async () => {
         try {
           const password = document.getElementById('loginPassword').value;
           if (!password) {
             alert('Password required');
             return;
           }
           
           // Use the password to decrypt (same as export)
           apiKey = await window.EncryptionUtils.retrieveTelegramKey(password);
           console.log('✅ Decryption successful');
           
           // Continue with the rest of the login process
           continueLoginProcess(apiKey);
         } catch (error) {
           console.error('❌ Decryption error:', error);
           document.getElementById('content').innerHTML = `
             <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
               <h3>❌ Login Error</h3>
               <p>There was an issue decrypting your key. Please check your password and try again.</p>
               <button onclick="window.login()" style="background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
                 🔄 Try Again
               </button>
             </div>
           `;
         }
       };
       
       // Return early - the rest will be handled by submitLogin
       return;
      
             // This code is now handled by the input field approach above
      
    } else {
      // Handle legacy unencrypted keys
      const storedData = await new Promise((resolve) => {
        window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
          resolve(value ? JSON.parse(value) : null);
        });
      });
      
      if (!storedData) throw new Error('No stored key found');
      
      console.log('Legacy unencrypted key detected:', {
        hasApiPublicKey: !!storedData.apiPublicKey,
        hasApiPrivateKey: !!storedData.apiPrivateKey
      });
      
      if (storedData.apiPublicKey && storedData.apiPrivateKey) {
        // Offer to migrate legacy key
        const migrate = confirm('You have a legacy unencrypted key. Would you like to secure it with a password?');
        if (migrate) {
          password = prompt('Create a password to encrypt your existing key:');
          if (password) {
            await window.EncryptionUtils.migrateLegacyKey(password);
            apiKey = await window.EncryptionUtils.retrieveTelegramKey(password);
            console.log('✅ Legacy key migrated and decrypted');
          } else {
            throw new Error('Password required for migration');
          }
        } else {
          // Use legacy key without encryption (temporarily)
          apiKey = {
            apiPublicKey: storedData.apiPublicKey,
            apiPrivateKey: storedData.apiPrivateKey
          };
          console.log('⚠️ Using legacy unencrypted key');
        }
      } else {
        throw new Error('Invalid key format - please re-register');
      }
    }

    // Create manual stamper using our decrypted keys (bypasses TelegramCloudStorageStamper)
    const stamper = createManualStamper(apiKey.apiPrivateKey, apiKey.apiPublicKey);

    console.log('Retrieved API key:', apiKey); // Debug

    if (!apiKey || !apiKey.apiPublicKey || !apiKey.apiPrivateKey) {
      throw new Error('Failed to retrieve valid API key from Telegram Cloud Storage');
    }

    // REMOVED: Hardcoded public key validation
    // const expectedPublicKey = '023dca6fc4a0b275e19c1c6caac0c6ce8efb70461ffe6a1e360d10b725794811e3';
    // if (apiKey.apiPublicKey !== expectedPublicKey) {
    //   throw new Error(`API public key mismatch: got ${apiKey.apiPublicKey}, expected ${expectedPublicKey}`);
    // }

    // REPLACED with optional format validation:
    if (!apiKey.apiPublicKey || !apiKey.apiPrivateKey) {
      throw new Error('Invalid API key format');
    }

    // Fetch userId from backend
    const userIdResponse = await fetch(`/get-user-id?orgId=${orgId}`);
    if (!userIdResponse.ok) throw new Error('Failed to fetch userId');
    const { userId } = await userIdResponse.json();

    // Fetch email from backend
    let userEmail;
    const emailResponse = await fetch(`/get-user-email?orgId=${orgId}`);
    if (!emailResponse.ok) {
      console.warn('Email fetch failed, using fallback');
      userEmail = 'bpeterscqa@gmail.com';
    } else {
      const emailData = await emailResponse.json() || { email: 'bpeterscqa@gmail.com' };
      userEmail = emailData.email;
    }

    // Generate ephemeral key for HPKE
    const ephemeralKeyPair = await Turnkey.generateP256EphemeralKeyPair();
    if (!ephemeralKeyPair.uncompressedPublic) {
      throw new Error('Ephemeral keypair missing uncompressedPublic');
    }
    console.log('Ephemeral keypair:', ephemeralKeyPair); // Debug

    // Use the correct sub-organization ID if available (from backend signing)
    const correctOrgId = window.correctSubOrgId || orgId;
    console.log('🔧 Using organization ID:', correctOrgId, '(original:', orgId, ')');
    
    // Prepare body for createReadWriteSession (V2 structure)
    const body = {
      type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
      timestampMs: String(Date.now()),
      organizationId: correctOrgId,
      email: userEmail,
      parameters: {
        userId,
        expirationSeconds: "7776000",
        targetPublicKey: ephemeralKeyPair.uncompressedPublic,
        apiKeyName: `Read Write Session - ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
        invalidateExisting: true
      }
    };
    const bodyStr = stringifySorted(body);
    console.log('Sent body:', bodyStr);

    // Use manual stamper to sign the bodyStr
    const stamp = await stamper.stamp(bodyStr);
    const stampJson = stringifySorted(stamp);
    const stampEncoded = btoa(stampJson)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    console.log('Generated stamp:', stampEncoded);

    // Send to backend proxy
    const response = await fetch('/mini-app/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: bodyStr,
        stamp: stampEncoded,
        ephemeralPrivateKey: ephemeralKeyPair.privateKey,
        initData: window.Telegram.WebApp.initData
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${errorText}`);
    }

    document.getElementById('content').innerHTML = 'Session started! Temp keys stored.';
  } catch (error) {
    console.error('Login error:', error);
    
    // Enhanced mobile error handling
    if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
      MobileEncryptionFix.handleMobileError(error, 'login process');
    }
    
    document.getElementById('content').innerHTML = 'Error: ' + error.message;
  }
};

// Continue login process after mobile password decryption
async function continueLoginProcess(apiKey) {
  try {
    // Get the orgId and email from the original login function scope
    const urlParams = new URLSearchParams(window.location.search);
    const orgId = urlParams.get('orgId');
    const email = urlParams.get('email');
    
    if (!orgId) {
      document.getElementById('content').innerHTML = 'Error: Missing orgId parameter';
      return;
    }
    
    console.log('🔍 continueLoginProcess - orgId:', orgId, 'email:', email);
    console.log('🔍 continueLoginProcess - apiKey available:', !!apiKey);
    console.log('🔍 continueLoginProcess - apiKey parameter:', apiKey ? 'present' : 'missing');
    
    if (!apiKey) {
      throw new Error('API key not available in continueLoginProcess');
    }
    
    // Create manual stamper using our decrypted keys (bypasses TelegramCloudStorageStamper)
    const stamper = createManualStamper(apiKey.apiPrivateKey, apiKey.apiPublicKey);

    console.log('Retrieved API key:', apiKey); // Debug

    if (!apiKey || !apiKey.apiPublicKey || !apiKey.apiPrivateKey) {
      throw new Error('Failed to retrieve valid API key from Telegram Cloud Storage');
    }

    // REPLACED with optional format validation:
    if (!apiKey.apiPublicKey || !apiKey.apiPrivateKey) {
      throw new Error('Invalid API key format');
    }

    // Fetch userId from backend
    const userIdResponse = await fetch(`/get-user-id?orgId=${orgId}`);
    if (!userIdResponse.ok) throw new Error('Failed to fetch userId');
    const { userId } = await userIdResponse.json();

    // Fetch email from backend
    let userEmail;
    const emailResponse = await fetch(`/get-user-email?orgId=${orgId}`);
    if (!emailResponse.ok) {
      console.warn('Email fetch failed, using fallback');
      userEmail = 'bpeterscqa@gmail.com';
    } else {
      const emailData = await emailResponse.json() || { email: 'bpeterscqa@gmail.com' };
      userEmail = emailData.email;
    }

    // Generate ephemeral key for HPKE
    const ephemeralKeyPair = await Turnkey.generateP256EphemeralKeyPair();
    if (!ephemeralKeyPair.uncompressedPublic) {
      throw new Error('Ephemeral keypair missing uncompressedPublic');
    }
    console.log('Ephemeral keypair:', ephemeralKeyPair); // Debug

    // Use the correct sub-organization ID if available (from backend signing)
    const correctOrgId = window.correctSubOrgId || orgId;
    console.log('🔧 Using organization ID:', correctOrgId, '(original:', orgId, ')');
    
    // Prepare body for createReadWriteSession (V2 structure)
    const body = {
      type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
      timestampMs: String(Date.now()),
      organizationId: correctOrgId,
      email: userEmail,
      parameters: {
        userId,
        expirationSeconds: "7776000",
        targetPublicKey: ephemeralKeyPair.uncompressedPublic,
        apiKeyName: `Read Write Session - ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
        invalidateExisting: true
      }
    };
    const bodyStr = stringifySorted(body);
    console.log('Sent body:', bodyStr);

    // Use manual stamper to sign the bodyStr
    const stamp = await stamper.stamp(bodyStr);
    const stampJson = stringifySorted(stamp);
    const stampEncoded = btoa(stampJson)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    console.log('Generated stamp:', stampEncoded);

    // Send to backend proxy
    const response = await fetch('/mini-app/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: bodyStr,
        stamp: stampEncoded,
        ephemeralPrivateKey: ephemeralKeyPair.privateKey,
        initData: window.Telegram.WebApp.initData
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${errorText}`);
    }

    document.getElementById('content').innerHTML = 'Session started! Temp keys stored.';
  } catch (error) {
    console.error('Login error:', error);
    
    // Enhanced mobile error handling
    if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
      MobileEncryptionFix.handleMobileError(error, 'login process');
    }
    
    document.getElementById('content').innerHTML = 'Error: ' + error.message;
  }
}

// Make login function globally available
window.login = login;
