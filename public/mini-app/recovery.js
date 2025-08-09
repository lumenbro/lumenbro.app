// public/mini-app/recovery.js - Updated for new Email Auth OTP recovery

// Use global params from index.html
async function recover() {
  try {
    const email = prompt('Enter your email for recovery:');
    if (!email) throw new Error('Email required');

    // Generate target public key for recovery encryption
    const targetKeyPair = await window.Turnkey.generateP256ApiKeyPair();
    const targetPublicKey = targetKeyPair.publicKey;

    // Step 1: Initiate recovery via backend
    document.getElementById('content').innerHTML = 'Sending recovery email...';
    
    const initResponse = await fetch('/init-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, email, targetPublicKey })
    });
    
    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      throw new Error(errorData.error || 'Recovery initiation failed');
    }

    // Step 2: Prompt for OTP code from email
    document.getElementById('content').innerHTML = 'Check your email for the recovery code and enter it below:<br><br><input type="text" id="otpCode" placeholder="Enter OTP code"><br><button onclick="completeRecovery()">Complete Recovery</button>';
    
    // Store data for completion step
    window.recoveryData = { orgId, email, targetKeyPair };

  } catch (error) {
    console.error('Recovery error:', error);
    document.getElementById('content').innerHTML = 'Recovery failed: ' + error.message;
  }
}

async function completeRecovery() {
  try {
    const otpCode = document.getElementById('otpCode').value.trim();
    if (!otpCode) throw new Error('Please enter the OTP code');

    const { orgId, email, targetKeyPair } = window.recoveryData;

    document.getElementById('content').innerHTML = 'Completing recovery...';

    // Step 3: Generate new passkey using WebAuthn
    const newPasskey = await navigator.credentials.create({
      publicKey: {
        challenge: new TextEncoder().encode(otpCode),
        rp: { name: "LumenBro" },
        user: {
          id: new TextEncoder().encode(email),
          name: email,
          displayName: "LumenBro User"
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        }
      }
    });

    // Step 4: Complete recovery with new passkey
    const completeResponse = await fetch('/complete-otp-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        email,
        otpCode,
        newPasskey: {
          id: Array.from(new Uint8Array(newPasskey.rawId)),
          response: {
            attestationObject: Array.from(new Uint8Array(newPasskey.response.attestationObject)),
            clientDataJSON: Array.from(new Uint8Array(newPasskey.response.clientDataJSON))
          }
        }
      })
    });

    if (!completeResponse.ok) {
      const errorData = await completeResponse.json();
      throw new Error(errorData.error || 'Recovery completion failed');
    }

    const result = await completeResponse.json();

    // Step 5: Show success and wallet options
    document.getElementById('content').innerHTML = `
      <h3>✅ Recovery Successful!</h3>
      <p>Your wallet has been recovered. Choose what to do next:</p>
      <button onclick="accessWallet()">Access Web Wallet</button>
      <button onclick="setupBot()">Setup Bot Trading</button>
      <button onclick="exportKeys()">Export Private Keys</button>
    `;

    // Store recovery result for wallet access
    window.recoveryResult = result;

  } catch (error) {
    console.error('Recovery completion error:', error);
    document.getElementById('content').innerHTML = 'Recovery completion failed: ' + error.message;
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
