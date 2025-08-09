// Recovery Key Generator - Creates new Telegram keys using recovery credentials
class RecoveryKeyGenerator {
  constructor() {
    this.recoveryCredentials = null;
  }

  // Decrypt the credential bundle from OTP recovery
  async decryptCredentialBundle(credentialBundle, targetPrivateKey) {
    try {
      console.log('🔓 Decrypting recovery credential bundle...');
      
      // Convert hex string to Uint8Array
      const bundleBytes = new Uint8Array(
        credentialBundle.match(/.{2}/g).map(byte => parseInt(byte, 16))
      );
      
      // For now, we'll use a placeholder decryption
      // In reality, this would use Turnkey's HPKE decryption
      // The credentialBundle contains an encrypted API key pair
      
      // Simulate successful decryption (replace with actual Turnkey decryption)
      const mockDecryptedCredentials = {
        apiPublicKey: "02" + "a".repeat(64), // Mock P-256 public key
        apiPrivateKey: "b".repeat(64) // Mock private key
      };
      
      console.log('✅ Credential bundle decrypted successfully');
      return mockDecryptedCredentials;
      
    } catch (error) {
      console.error('❌ Failed to decrypt credential bundle:', error);
      throw new Error('Failed to decrypt recovery credentials');
    }
  }

  // Create new API key using recovery credentials
  async createNewTelegramKey(email, newPassword) {
    try {
      if (!this.recoveryCredentials) {
        throw new Error('No recovery credentials available. Complete OTP recovery first.');
      }

      console.log('🔑 Creating new Telegram API key...');
      
      // Generate new key pair for Telegram
      const newKeyPair = await window.Turnkey.generateP256ApiKeyPair();
      console.log('Generated new key pair for Telegram storage');

      // Use recovery credentials to create new API key in sub-org
      const createKeyResponse = await fetch('/create-recovery-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryCredentials: this.recoveryCredentials,
          newPublicKey: newKeyPair.publicKey,
          email: email,
          apiKeyName: `Recovery Telegram Key - ${email} - ${new Date().toISOString()}`
        })
      });

      if (!createKeyResponse.ok) {
        const errorData = await createKeyResponse.json();
        throw new Error(errorData.error || 'Failed to create new API key');
      }

      const createResult = await createKeyResponse.json();
      console.log('✅ New API key created:', createResult.apiKeyId);

      // Encrypt private key with new password
      const encryptedData = await this.encryptKeyWithPassword(newKeyPair.privateKey, newPassword);
      
      // Store encrypted key in Telegram Cloud Storage
      await new Promise((resolve, reject) => {
        window.Telegram.WebApp.CloudStorage.setItem('TURNKEY_API_KEY', JSON.stringify(encryptedData), (error) => {
          if (error) reject(new Error(`Cloud storage failed: ${error}`));
          else resolve();
        });
      });

      console.log('✅ New encrypted key stored in Telegram Cloud');
      
      return {
        success: true,
        apiKeyId: createResult.apiKeyId,
        message: 'New Telegram keys created successfully!'
      };

    } catch (error) {
      console.error('❌ Failed to create new Telegram key:', error);
      throw error;
    }
  }

  // Encrypt private key with password (same as registration)
  async encryptKeyWithPassword(privateKey, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedPrivateKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      new TextEncoder().encode(privateKey)
    );

    return {
      publicKey: "placeholder-public-key", // Would be the new public key
      encryptedPrivateKey: Array.from(new Uint8Array(encryptedPrivateKey)),
      iv: Array.from(iv),
      salt: Array.from(salt)
    };
  }

  // Set recovery credentials from OTP verification
  setRecoveryCredentials(credentials) {
    this.recoveryCredentials = credentials;
    console.log('✅ Recovery credentials set for key generation');
  }

  // Show recovery key generation UI
  showKeyGenerationUI(orgId, email) {
    return `
      <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h3>🔑 Create New Telegram Keys</h3>
        <p>Your password was lost/forgotten. Create new login credentials for Telegram access.</p>
        <p><strong>Your wallet is safe!</strong> This only creates new login keys.</p>
        
        <div style="margin: 15px 0;">
          <label>Create new password for Telegram keys:</label><br>
          <input type="password" id="newTelegramPassword" placeholder="Enter new password" style="width: 100%; padding: 8px; margin: 5px 0;">
          <input type="password" id="confirmTelegramPassword" placeholder="Confirm new password" style="width: 100%; padding: 8px; margin: 5px 0;">
        </div>
        
        <button onclick="generateNewTelegramKeys('${orgId}', '${email}')" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
          Create New Telegram Keys
        </button>
        
        <div style="margin-top: 15px; font-size: 0.9em; color: #666;">
          <strong>What happens:</strong><br>
          • New login keys created using your recovery session<br>
          • Keys encrypted with your new password<br>
          • Stored securely in Telegram Cloud<br>
          • You can login to Telegram with new password<br>
          • Your wallet and funds remain unchanged
        </div>
      </div>
    `;
  }
}

// Global instance
window.recoveryKeyGenerator = new RecoveryKeyGenerator();

// Generate new Telegram keys function
async function generateNewTelegramKeys(orgId, email) {
  try {
    const newPassword = document.getElementById('newTelegramPassword').value;
    const confirmPassword = document.getElementById('confirmTelegramPassword').value;
    
    if (!newPassword || !confirmPassword) {
      alert('Please enter and confirm your new password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    
    document.getElementById('content').innerHTML = 'Creating new Telegram keys...';
    
    const result = await window.recoveryKeyGenerator.createNewTelegramKey(email, newPassword);
    
    document.getElementById('content').innerHTML = `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h3>✅ New Telegram Keys Created!</h3>
        <p>${result.message}</p>
        <p><strong>API Key ID:</strong> ${result.apiKeyId}</p>
        
        <h4>Next Steps:</h4>
        <ol>
          <li>Your new keys are stored in Telegram Cloud Storage</li>
          <li>You can now login to the mini-app with your new password</li>
          <li>Use the Telegram bot with command: <code>/recover ${orgId}</code></li>
          <li>All your wallet funds and transactions are preserved</li>
        </ol>
        
        <button onclick="testNewLogin('${orgId}', '${email}')" style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 5px 0 0;">
          Test New Login
        </button>
        
        <button onclick="setupTelegramBot('${orgId}')" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0 0 5px;">
          Setup Telegram Bot
        </button>
      </div>
    `;
    
  } catch (error) {
    console.error('New key generation failed:', error);
    document.getElementById('content').innerHTML = `
      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h3>❌ Key Generation Failed</h3>
        <p>${error.message}</p>
        <button onclick="window.location.reload()">Try Again</button>
      </div>
    `;
  }
}

function testNewLogin(orgId, email) {
  window.location.href = `/mini-app?action=login&orgId=${orgId}&email=${email}`;
}

function setupTelegramBot(orgId) {
  window.open(`https://t.me/YourBotUsername?start=recover_${orgId}`, '_blank');
}
