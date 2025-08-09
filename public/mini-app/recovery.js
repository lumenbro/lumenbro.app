// public/mini-app/recovery.js - Updated for new Email Auth OTP recovery

// Use global params from index.html or handle lost orgId case
async function recover() {
    try {
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

    // Generate uncompressed P-256 key pair for recovery encryption
    const cryptoKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    
    // Export public key in uncompressed format (65 bytes)
    const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', cryptoKeyPair.publicKey);
    const targetPublicKey = Array.from(new Uint8Array(publicKeyBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    // Export private key for later decryption
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', cryptoKeyPair.privateKey);
    const targetPrivateKey = Array.from(new Uint8Array(privateKeyBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    const targetKeyPair = {
      publicKey: targetPublicKey,
      privateKey: targetPrivateKey
    };
    
    console.log('Target public key length:', targetPublicKey.length, 'bytes:', targetPublicKey.length / 2);

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
      <div style="background: #e7f3ff; border: 1px solid #b3d7ff; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>📧 Recovery Email Sent!</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Organization:</strong> ${responseOrgId}</p>
        <p>Check your email for a 6-digit recovery code:</p>
        
        <div style="margin: 15px 0;">
          <input type="text" id="otpCode" placeholder="Enter 6-digit code" style="padding: 10px; width: 200px; text-align: center; font-size: 18px; border: 2px solid #ddd; border-radius: 5px;" maxlength="6">
        </div>
        
        <button onclick="completeRecovery()" style="background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
          Complete Recovery
        </button>
        
        <div style="margin-top: 15px; font-size: 0.9em; color: #666;">
          <p>💡 <strong>Note:</strong> The code expires in 5 minutes</p>
          <p>📱 If you don't see the email, check your spam folder</p>
        </div>
      </div>
    `;
    
    // Store data for completion step
    window.recoveryData = { orgId: responseOrgId, email, targetKeyPair, otpId };

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
        
        <button onclick="recover()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin-top: 15px;">
          Try Again
        </button>
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

    // Step 3: Verify OTP and get session credentials
    const verifyResponse = await fetch('/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        otpId,
        otpCode,
        targetPublicKey: targetKeyPair.publicKey,
        email
      })
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      throw new Error(errorData.error || 'OTP verification failed');
    }

    const result = await verifyResponse.json();

    // Parse the recovery credentials from the credential bundle
    const decryptedCredentials = await decryptCredentialBundle(result.credentialBundle, targetKeyPair.privateKey);
    
    // Set recovery credentials for key generation
    window.recoveryKeyGenerator.setRecoveryCredentials({
      ...decryptedCredentials,
      userId: result.userId,
      apiKeyId: result.apiKeyId,
      orgId: orgId,
      email: email,
      expiresAt: Date.now() + (3600 * 1000) // 1 hour
    });

    // Show recovery success with option to create new Telegram keys
    document.getElementById('content').innerHTML = `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>✅ Email Recovery Successful!</h3>
        <p><strong>Organization:</strong> ${orgId}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>You now have temporary access to your wallet. Choose an option:</p>
        
        <div style="margin: 15px 0;">
          <button onclick="generateNewTelegramKeys()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
            🔑 Create New Telegram Keys
          </button>
          <p style="font-size: 0.9em; color: #666;">Recommended: Create new encrypted keys for Telegram bot access</p>
        </div>

        <div style="margin: 15px 0;">
          <button onclick="accessWallet('${orgId}')" style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
            💰 Access Wallet Directly
          </button>
          <p style="font-size: 0.9em; color: #666;">Use web interface (temporary 1-hour session)</p>
        </div>
      </div>
    `;

  } catch (error) {
    console.error('Recovery completion error:', error);
    document.getElementById('content').innerHTML = 'Recovery completion failed: ' + error.message;
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
  // Redirect to wallet with recovery flag
  window.location.href = '/wallet.html?recovered=true&orgId=' + window.recoveryData.orgId;
}

function setupBot() {
  // Guide user to bot setup
  document.getElementById('content').innerHTML = `
    <h3>🤖 Bot Trading Setup</h3>
    <p>Your wallet is now recovered! To enable bot trading:</p>
    <ol>
      <li>Open Telegram and find the LumenBro bot</li>
      <li>Send /start to the bot</li>
      <li>Your recovered wallet will be automatically detected</li>
      <li>You can now use copy trading features</li>
    </ol>
    <button onclick="openTelegram()">Open Telegram Bot</button>
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
    const result = await window.recoveryKeyGenerator.generateNewTelegramKey(password);
    
    console.log('✅ New Telegram keys generated successfully:', result);
    
    document.getElementById('content').innerHTML = `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>🎉 Recovery Complete!</h3>
        <p><strong>New API Key Created:</strong> ${result.apiKeyId}</p>
        <p><strong>Encryption:</strong> ✅ Secured with your password</p>
        <p><strong>Storage:</strong> ✅ Saved to Telegram Cloud</p>
        
        <div style="margin: 20px 0; padding: 15px; background: #e7f3ff; border-radius: 5px;">
          <h4>🎯 What's Next?</h4>
          <ol style="text-align: left; margin: 10px 0;">
            <li><strong>Test Login:</strong> Try logging in to verify your new keys work</li>
            <li><strong>Bot Access:</strong> Your Telegram bot can now access your wallet</li>
            <li><strong>Password:</strong> Remember your password - you'll need it to log in</li>
          </ol>
        </div>
        
        <div style="margin: 15px 0;">
          <button onclick="testLogin()" style="background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; font-size: 16px;">
            🔐 Test Login
          </button>
          <button onclick="accessWallet('${window.recoveryData.orgId}')" style="background: #17a2b8; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; font-size: 16px;">
            💰 Access Wallet
          </button>
        </div>
        
        <p style="font-size: 0.9em; color: #666; margin-top: 15px;">
          💡 <strong>Important:</strong> Your recovery is now complete. The temporary recovery session will expire in ${status.expiresIn} minutes.
        </p>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ Failed to generate new Telegram keys:', error);
    document.getElementById('content').innerHTML = `
      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
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
        
        <button onclick="recover()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin-top: 15px;">
          🔄 Start Recovery Again
        </button>
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
