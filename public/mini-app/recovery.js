// public/mini-app/recovery.js - Updated for new Email Auth recovery with credential bundle

// Use global params from index.html – no local orgId const

async function recover() {
  try {
    const email = prompt('Enter your email for recovery:');

    // Generate target public key for recovery (e.g., new passkey public key for encryption)
    const targetKeyPair = Turnkey.generateP256KeyPair();
    const targetPublicKey = targetKeyPair.publicKey;
    const targetPrivateKey = targetKeyPair.privateKey;  // Store securely for decryption

    // Init recovery via backend (same as before)
    const initResponse = await fetch('/init-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, email, targetPublicKey })
    });
    if (!initResponse.ok) throw new Error('Init recovery failed');

    // NEW: Prompt for pasted encrypted code from email
    const encryptedCode = prompt('Check your email and paste the recovery code here:');
    if (!encryptedCode) throw new Error('No code provided');

    // NEW: Decrypt code client-side using target private key (use Turnkey SDK helper if available; example with WebCrypto)
    const decryptedCredential = await Turnkey.decryptWithPrivateKey(encryptedCode, targetPrivateKey);  // Adjust to actual SDK method or implement with crypto.subtle
    // Assuming decryptedCredential is a private key for temporary recovery authenticator

    // NEW: Generate new passkey for addition
    const newPasskey = await Turnkey.createPasskey({ /* params */ });  // Use WebAuthn via Turnkey SDK

    // NEW: Use decrypted credential to sign and add new passkey as authenticator
    const tempStamper = new Turnkey.PrivateKeyStamper({ privateKey: decryptedCredential });  // Create temporary stamper
    const addResponse = await turnkeyClient.addAuthenticator({
      organizationId: orgId,
      userId: '',  // TODO: from init response or DB
      authenticator: {},  // TODO: newPasskey details
      stamper: tempStamper  // Signs with temporary key
    });
    if (!addResponse.success) throw new Error('Failed to add new passkey');

    // Optional: Create session with new passkey
    // await Turnkey.createSession({ /* params */ });

    document.getElementById('content').innerHTML = 'Recovery complete! New passkey added.';
  } catch (error) {
    console.error(error);
    document.getElementById('content').innerHTML = 'Error: ' + error.message;
  }
}

// NEW: Call recover on load or button click
// document.addEventListener('DOMContentLoaded', recover);  // Uncomment if auto-start
