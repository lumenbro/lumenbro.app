// public/mini-app/recovery.js - Updated for new Email Auth OTP recovery

// Use global params from index.html or handle lost orgId case
async function recover() {
    try {
        // Enhanced mobile error handling
        if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
            console.log('🔧 Mobile recovery detected - applying enhanced error handling');
        }
        
        // CRITICAL: Handle case where Telegram Cloud Storage was cleared
        // In this case, we won't have the orgId from the URL params
        let email = window.email || '';
        let orgId = window.orgId || '';
    
    // If no email from URL params, prompt user
    if (!email || email === 'unknown@lumenbro.com') {
      email = prompt('Enter your registered email address:');
      if (!email) throw new Error('Email required for recovery');
    }
    
    console.log('🔍 Starting recovery for email:', email);
    console.log('🏢 Initial orgId from URL:', orgId || 'NOT PROVIDED');

    // Generate P-256 key pair using Turnkey helpers to match expected formats
    try {
      const keyPair = await window.Turnkey.generateP256KeyPair();
      const targetKeyPair = {
        publicKey: keyPair.publicKeyUncompressed, // 04 + X + Y (65 bytes, hex length 130)
        privateKey: keyPair.privateKey            // 32-byte hex (length 64)
      };

      console.log('Target public key length:', targetKeyPair.publicKey.length, 'bytes:', targetKeyPair.publicKey.length / 2);

    // Step 1: First lookup orgId by email if we don't have it
    document.getElementById('content').innerHTML = 'Looking up your wallet...';
    
    if (!orgId || orgId === 'undefined') {
      console.log('🔍 No orgId provided, looking up by email...');
      
      const lookupResponse = await fetch('/lookup-org-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      
      if (!lookupResponse.ok) {
        const errorData = await lookupResponse.json();
        throw new Error(errorData.error || 'Could not find wallet for this email');
      }
      
      const lookupData = await lookupResponse.json();
      orgId = lookupData.orgId;
      console.log('✅ Found orgId:', orgId);
    }

    // Step 2: Initiate OTP recovery with found orgId
    document.getElementById('content').innerHTML = 'Sending recovery email...';
    
    const initResponse = await fetch('/init-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });
    
    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      throw new Error(errorData.error || 'Recovery initiation failed');
    }

    const initData = await initResponse.json();
    const { otpId, orgId: responseOrgId } = initData;

    // Step 3: Prompt for OTP code from email
    document.getElementById('content').innerHTML = `
      <div class="recovery-card">
        <h3>📧 Recovery Email Sent!</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Organization:</strong> ${responseOrgId}</p>
        <p>Check your email for a 6-digit recovery code:</p>
        
        <div style="margin: 15px 0;">
          <input type="text" id="otpCode" placeholder="Enter 6-digit code" class="recovery-input" maxlength="6">
        </div>
        
        <button onclick="completeRecovery()" class="recovery-button">
          Complete Recovery
        </button>
        
        <div class="recovery-note">
          <p>💡 <strong>Note:</strong> The code expires in 5 minutes</p>
          <p>📱 If you don't see the email, check your spam folder</p>
        </div>
      </div>
    `;
    
    // Store data for completion step
    window.recoveryData = { orgId: responseOrgId, email, targetKeyPair, otpId };
    } catch (error) {
      // fallthrough to existing catch
      throw error;
    }

  } catch (error) {
    console.error('Recovery error:', error);
    document.getElementById('content').innerHTML = `
      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>❌ Recovery Failed</h3>
        <p><strong>Error:</strong> ${error.message}</p>
        
        <div style="margin-top: 15px;">
          <h4>💡 Troubleshooting:</h4>
          <ul style="text-align: left;">
            <li>Make sure you're using the same email address you registered with</li>
            <li>Check if you have an active wallet in our system</li>
            <li>Try the standalone recovery page: <a href="/recovery" target="_blank">lumenbro.com/recovery</a></li>
          </ul>
        </div>
        
        <div style="margin-top: 15px;">
          <button onclick="recover()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
            🔄 Try Again
          </button>
          <button onclick="goBackToMain()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
            ← Back to Main Menu
          </button>
        </div>
      </div>
    `;
  }
}

async function completeRecovery() {
  try {
    const otpCode = document.getElementById('otpCode').value.trim();
    if (!otpCode) throw new Error('Please enter the OTP code');

    const { orgId, email, targetKeyPair, otpId } = window.recoveryData;

    document.getElementById('content').innerHTML = 'Verifying OTP code...';

    // Step 3: Verify OTP and decrypt on server (bypass WebView HPKE)
    const verifyResponse = await fetch('/verify-otp-decrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        otpId,
        otpCode,
        targetPublicKey: targetKeyPair.publicKey,
        targetPrivateKey: targetKeyPair.privateKey,
        email,
        initData: (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ? window.Telegram.WebApp.initData : ''
      })
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      throw new Error(errorData.error || 'OTP verification failed');
    }

    const result = await verifyResponse.json();
    // Use server-decrypted session key
    const serverSessionKey = result.sessionPrivateKey;
    if (!serverSessionKey || !/^[0-9a-fA-F]{64}$/.test(serverSessionKey)) {
      throw new Error('Invalid session key from server');
    }
    
    // Set recovery credentials for key generation
    // Normalize to sessionPrivateKey hex
    const sessionPrivateKey = serverSessionKey;
    if (!sessionPrivateKey || !/^[0-9a-fA-F]{64}$/.test(sessionPrivateKey)) {
      console.error('❌ Invalid sessionPrivateKey from decrypted credentials');
      document.getElementById('content').innerHTML = `
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
          <h3>❌ Recovery Failed</h3>
          <p>Recovered session key invalid. Please retry recovery.</p>
        </div>`;
      return;
    }

    window.recoveryKeyGenerator.setRecoveryCredentials({
      userId: result.userId,
      apiKeyId: result.apiKeyId,
      orgId: result.orgId || orgId,
      email: email,
      sessionPrivateKey,
      expiresAt: Date.now() + (3600 * 1000) // 1 hour
    });

    // Show recovery success with option to create new Telegram keys
    document.getElementById('content').innerHTML = `
      <div class="success-message">
        <h3>✅ Email Recovery Successful!</h3>
        <p><strong>Organization:</strong> ${orgId}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>You now have temporary access to your wallet. Choose an option:</p>
        
        <div style="margin: 15px 0;">
          <button onclick="generateNewTelegramKeys()" class="btn-primary">
            🔑 Create New Telegram Keys
          </button>
          <p class="recovery-note">Recommended: Create new encrypted keys for Telegram bot access</p>
        </div>

        <div class="warning-card">
          <h4 style="margin-top: 0;">🚧 Wallet Access (Coming Soon)</h4>
          <p style="margin-bottom: 10px;">
            Direct wallet access is currently under development. For now, please use the Telegram bot for trading.
          </p>
          <button onclick="setupBot()" class="btn-secondary">
            🤖 Setup Bot Access
          </button>
        </div>
        
        <div style="margin: 15px 0;">
          <button onclick="goBackToMain()" class="btn-secondary">
            ← Back to Main Menu
          </button>
        </div>
        
        <div style="margin-top:8px;">
          <span class="tk-badge">
            <img src="/media/Turnkey%20-%20gray.svg" alt="Turnkey" />
            Wallets secured by Turnkey
          </span>
        </div>
      </div>
    `;

  } catch (error) {
    console.error('Recovery completion error:', error);
    document.getElementById('content').innerHTML = `
      <div class="error-message">
        <h3>❌ Recovery Completion Failed</h3>
        <p><strong>Error:</strong> ${error.message}</p>
        
        <div style="margin-top: 15px;">
          <h4>💡 Possible Solutions:</h4>
          <ul style="text-align: left;">
            <li>The OTP code may have expired - try recovery again</li>
            <li>Make sure you entered the 6-digit code correctly</li>
            <li>Check your email for the recovery code</li>
          </ul>
        </div>
        
        <div style="margin-top: 15px;">
          <button onclick="recover()" class="btn-secondary">
            🔄 Start Recovery Again
          </button>
          <button onclick="goBackToMain()" class="btn-primary">
            ← Back to Main Menu
          </button>
        </div>
      </div>
    `;
  }
}

// Decrypt credential bundle using target private key (HPKE decryption)
async function decryptCredentialBundle(credentialBundle, targetPrivateKey) {
  try {
    console.log('🔓 Decrypting credential bundle with target private key...');
    
    // The credentialBundle is a hex string that contains the encrypted API key
    // We need to use HPKE decryption with our target private key
    
    // For now, parse the credentialBundle as hex-encoded API key
    // In a full implementation, this would use proper HPKE decryption
    
    // The credential bundle format from Turnkey contains the API key in hex
    const credentialHex = credentialBundle;
    
    // Extract the API key components (this is simplified)
    // In practice, you'd use the Turnkey SDK's decryption methods
    return {
      publicKey: credentialHex.substring(0, 66), // First 66 chars = compressed public key
      privateKey: credentialHex.substring(66, 130) // Next 64 chars = private key
    };
    
  } catch (error) {
    console.error('Credential bundle decryption failed:', error);
    throw new Error('Failed to decrypt recovery credentials');
  }
}

function accessWallet() {
  // Wallet access temporarily disabled - redirect to bot setup instead
  setupBot();
}

function setupBot() {
  // Guide user to bot setup
  document.getElementById('content').innerHTML = `
    <div style="background: #e7f3ff; border: 1px solid #b3d7ff; padding: 20px; margin: 10px 0; border-radius: 5px;">
      <h3>🤖 Bot Trading Setup</h3>
      <p>Your wallet is now recovered! To enable bot trading:</p>
      <ol style="text-align: left;">
        <li>Open Telegram and find the LumenBro bot</li>
        <li>Send /start to the bot</li>
        <li>Your recovered wallet will be automatically detected</li>
        <li>You can now use copy trading features</li>
      </ol>
      
      <div style="margin: 15px 0;">
        <button onclick="openTelegram()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
          📱 Open Telegram Bot
        </button>
        <button onclick="goBackToMain()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
          ← Back to Main Menu
        </button>
      </div>
    </div>
  `;
}

function goBackToMain() {
  // Return to the main mini-app interface
  document.getElementById('content').innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <h1>Welcome to LumenBro Trading Bot</h1>
      <div style="margin: 20px 0;">
        <button onclick="window.register()" style="background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; font-size: 16px;">
          📝 Register
        </button>
        <button onclick="window.login()" style="background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; font-size: 16px;">
          🔐 Login
        </button>
        <button onclick="window.recover()" style="background: #ffc107; color: #212529; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; font-size: 16px;">
          🔑 Recover
        </button>
      </div>
    </div>
  `;
}

function exportKeys() {
  // For now, explain that export requires Pro plan
  document.getElementById('content').innerHTML = `
    <h3>🔑 Export Private Keys</h3>
    <p><strong>Note:</strong> Private key export requires Turnkey Pro plan ($99/month).</p>
    <p>For now, your wallet is accessible through:</p>
    <ul>
      <li>✅ Web wallet interface</li>
      <li>✅ Telegram bot for trading</li>
      <li>✅ Mini-app for management</li>
    </ul>
    <p>Contact support if you need private key export for external wallet import.</p>
    <button onclick="recover()">← Back to Recovery</button>
  `;
}

function openTelegram() {
  window.open('https://t.me/YourBotUsername', '_blank');
}

// Generate new Telegram API keys after recovery
async function generateNewTelegramKeys() {
  try {
    // Enhanced mobile error handling
    if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
      console.log('🔧 Mobile key generation detected - applying enhanced error handling');
    }
    
    console.log('🔑 Starting Telegram key generation...');
    
    // Get password for encryption
    const password = prompt('Enter a password to encrypt your new Telegram keys:');
    if (!password) {
      throw new Error('Password required to encrypt keys');
    }
    
    // Check if recovery credentials are still valid
    const status = window.recoveryKeyGenerator.getRecoveryStatus();
    if (status.status !== 'active') {
      throw new Error(`Recovery session ${status.status}: ${status.message}`);
    }
    
    document.getElementById('content').innerHTML = `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>🔄 Generating New Telegram Keys...</h3>
        <p>Creating encrypted API keys for Telegram bot access...</p>
        <div style="margin: 10px 0;">
          <div style="width: 100%; background-color: #e9ecef; border-radius: 10px; height: 20px;">
            <div style="width: 50%; background-color: #007bff; height: 20px; border-radius: 10px; transition: width 0.3s;"></div>
          </div>
        </div>
      </div>
    `;
    
    // Generate new keys using recovery credentials
    let result;
    try {
        result = await window.recoveryKeyGenerator.generateNewTelegramKey(password);
        console.log('✅ New Telegram keys generated successfully:', result);
    } catch (error) {
        // Enhanced mobile error handling
        if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
            console.error('❌ Mobile key generation error:', error);
            MobileEncryptionFix.handleMobileError(error, 'recovery key generation');
            
            document.getElementById('content').innerHTML = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
                    <h3>❌ Mobile Key Generation Failed</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    
                    <div style="margin: 15px 0;">
                        <h4>💡 Mobile-Specific Solutions:</h4>
                        <ul style="text-align: left;">
                            <li>Try using desktop version for key generation</li>
                            <li>Check the debug console (🐛 button) for details</li>
                            <li>Ensure stable internet connection</li>
                            <li>Close other apps to free up memory</li>
                        </ul>
                    </div>
                    
                    <div style="margin-top: 15px;">
                        <button onclick="window.mobileDebug && window.mobileDebug.toggle()" style="background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px;">
                            🐛 Show Debug Info
                        </button>
                        <button onclick="recover()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin: 5px;">
                            🔄 Start Recovery Again
                        </button>
                        <button onclick="goBackToMain()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin: 5px;">
                            ← Back to Main Menu
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        throw error;
    }
    
    if (!result) return;
    document.getElementById('content').innerHTML = `
      <div class="success-message">
        <h3>🎉 Recovery Complete!</h3>
        <p><strong>New API Key Created:</strong> ${result.apiKeyId}</p>
        <p><strong>Encryption:</strong> ✅ Secured with your password</p>
        <p><strong>Storage:</strong> ✅ Saved to Telegram Cloud</p>
        
        <div class="info-card">
          <h4>🎯 What's Next?</h4>
          <ol style="text-align: left; margin: 10px 0;">
            <li><strong>Test Login:</strong> Try logging in to verify your new keys work</li>
            <li><strong>Bot Access:</strong> Your Telegram bot can now access your wallet</li>
            <li><strong>Password:</strong> Remember your password - you'll need it to log in</li>
          </ol>
        </div>
        
        <div style="margin: 15px 0;">
          <button onclick="testLogin()" class="btn-success">
            🔐 Test Login
          </button>
        </div>
        
        <p class="text-muted" style="font-size: 0.9em; margin-top: 15px;">
          💡 <strong>Important:</strong> Your recovery is now complete. The temporary recovery session will expire in ${status.expiresIn} minutes.
        </p>
      </div>
    `;
    
      } catch (error) {
        console.error('❌ Failed to generate new Telegram keys:', error);
        document.getElementById('content').innerHTML = `
          <div class="error-message">
            <h3>❌ Key Generation Failed</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            
            <div style="margin: 15px 0;">
              <h4>💡 Possible Solutions:</h4>
              <ul style="text-align: left;">
                <li>Your recovery session may have expired - try recovery again</li>
                <li>Check your internet connection</li>
                <li>Make sure you're using the same device where you started recovery</li>
              </ul>
            </div>
            
            <div style="margin-top: 15px;">
              <button onclick="recover()" class="btn-secondary">
                🔄 Start Recovery Again
              </button>
              <button onclick="goBackToMain()" class="btn-primary">
                ← Back to Main Menu
              </button>
            </div>
          </div>
        `;
      }
}

// Test login with new keys
async function testLogin() {
  try {
    console.log('🔐 Testing login with new keys...');
    
    // Redirect to login action
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('action', 'login');
    window.location.href = currentUrl.toString();
    
    } catch (error) {
    console.error('❌ Test login failed:', error);
    alert('Test login failed: ' + error.message);
    }
}

// NEW: Call recover on load or button click
// document.addEventListener('DOMContentLoaded', recover);  // Uncomment if auto-start
