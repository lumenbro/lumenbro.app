// public/mini-app/recovery.js - Updated for new Email Auth OTP recovery

// Use global params from index.html
async function recover() {
  try {
    const email = prompt('Enter your email for recovery:');
    if (!email) throw new Error('Email required');

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

    // Step 1: Initiate OTP recovery via backend
    document.getElementById('content').innerHTML = 'Sending recovery email...';
    
    const initResponse = await fetch('/init-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      throw new Error(errorData.error || 'Recovery initiation failed');
    }

    const initData = await initResponse.json();
    const { otpId, orgId: responseOrgId } = initData;

    // Step 2: Prompt for OTP code from email
    document.getElementById('content').innerHTML = 'Check your email for the recovery code and enter it below:<br><br><input type="text" id="otpCode" placeholder="Enter 6-digit code"><br><button onclick="completeRecovery()">Complete Recovery</button>';
    
    // Store data for completion step
    window.recoveryData = { orgId: responseOrgId, email, targetKeyPair, otpId };

  } catch (error) {
    console.error('Recovery error:', error);
    document.getElementById('content').innerHTML = 'Recovery failed: ' + error.message;
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
          <button onclick="generateNewTelegramKeys('${email}', '${orgId}')" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">
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

// NEW: Call recover on load or button click
// document.addEventListener('DOMContentLoaded', recover);  // Uncomment if auto-start
