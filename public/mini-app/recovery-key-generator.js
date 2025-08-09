// Recovery Key Generator - creates new Telegram API keys using recovery credentials
class RecoveryKeyGenerator {
  constructor() {
    this.recoveryCredentials = null;
  }

  // Set recovery credentials obtained from OTP verification
  setRecoveryCredentials(credentials) {
    this.recoveryCredentials = credentials;
    console.log('✅ Recovery credentials set for key generation');
  }

  // Create new Telegram API key using recovery credentials
  async createNewTelegramKey(email, orgId, password) {
    if (!this.recoveryCredentials) {
      throw new Error('Recovery credentials not set. Complete OTP verification first.');
    }

    if (!password) {
      throw new Error('Password required for key encryption');
    }

    try {
      console.log('🔑 Creating new Telegram API key...');
      
      // Generate new P256 keypair for Telegram
      const newKeyPair = await window.Turnkey.generateP256ApiKeyPair();
      console.log('Generated new key pair for Telegram storage');

      // Use recovery credentials to create the API key in Turnkey
      const apiKeyName = `Recovery Telegram Key - ${email} - ${new Date().toISOString()}`;
      
      // Create API key using recovery credentials (frontend signing)
      const createKeyResponse = await this.createApiKeyWithRecoveryCredentials(
        orgId,
        this.recoveryCredentials.userId, 
        newKeyPair.publicKey,
        apiKeyName
      );

      if (!createKeyResponse.success) {
        throw new Error('Failed to create new API key');
      }

      console.log('✅ New API key created in Turnkey');

      // Encrypt and store the new key in Telegram Cloud Storage
      await window.EncryptionUtils.storeTelegramKey(
        newKeyPair.publicKey, 
        newKeyPair.privateKey, 
        password
      );

      console.log('✅ New encrypted key stored in Telegram Cloud Storage');

      return {
        success: true,
        publicKey: newKeyPair.publicKey,
        message: 'New Telegram key created and stored successfully!'
      };

    } catch (error) {
      console.error('❌ Failed to create new Telegram key:', error);
      throw error;
    }
  }

  // Create API key using recovery credentials to sign the request
  async createApiKeyWithRecoveryCredentials(orgId, userId, publicKey, apiKeyName) {
    try {
      // Use the recovery credentials to sign a CREATE_API_KEYS_V2 activity
      const stamper = new window.Turnkey.ApiKeyStamper({
        apiPublicKey: this.recoveryCredentials.publicKey,
        apiPrivateKey: this.recoveryCredentials.privateKey
      });

      const client = new window.Turnkey.TurnkeyBrowserClient({
        baseUrl: 'https://api.turnkey.com',
        stamper: stamper,
        defaultOrganizationId: orgId
      });

      const response = await client.createApiKeys({
        organizationId: orgId,
        userId: userId,
        apiKeys: [{
          apiKeyName: apiKeyName,
          publicKey: publicKey,
          curveType: "API_KEY_CURVE_SECP256K1"
        }]
      });

      return { 
        success: true, 
        response: response,
        apiKeyId: response.activity?.result?.createApiKeysResult?.apiKeyIds?.[0]
      };

    } catch (error) {
      console.error('Recovery API key creation error:', error);
      
      // Call the backend endpoint as fallback (for logging/monitoring)
      try {
        const backendResponse = await fetch('/create-recovery-api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.recoveryCredentials.email,
            orgId: orgId,
            publicKey: publicKey,
            apiKeyName: apiKeyName
          })
        });
        
        if (!backendResponse.ok) {
          throw new Error(`Backend call failed: ${backendResponse.status}`);
        }
        
        const backendData = await backendResponse.json();
        console.log('Backend response:', backendData);
        
      } catch (backendError) {
        console.error('Backend fallback also failed:', backendError.message);
      }
      
      return { success: false, error: error.message };
    }
  }

  // Clear recovery credentials after use
  clearRecoveryCredentials() {
    this.recoveryCredentials = null;
    console.log('Recovery credentials cleared');
  }

  // Get current recovery status
  getRecoveryStatus() {
    return {
      hasCredentials: !!this.recoveryCredentials,
      email: this.recoveryCredentials?.email,
      orgId: this.recoveryCredentials?.orgId,
      expiresAt: this.recoveryCredentials?.expiresAt
    };
  }
}

// Global instance
window.recoveryKeyGenerator = new RecoveryKeyGenerator();

// Helper function to generate new Telegram keys (called from UI)
async function generateNewTelegramKeys(email, orgId) {
  try {
    const password = prompt('Create a password for your new Telegram keys:');
    if (!password) {
      throw new Error('Password required');
    }

    const confirmPassword = prompt('Confirm your password:');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    console.log('Starting new key generation...');
    
    const result = await window.recoveryKeyGenerator.createNewTelegramKey(email, orgId, password);
    
    if (result.success) {
      // Update UI to show success
      document.getElementById('content').innerHTML = `
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
          <h3>✅ New Telegram Keys Created!</h3>
          <p>Your new encrypted API keys have been created and stored in Telegram Cloud Storage.</p>
          <p><strong>Public Key:</strong> ${result.publicKey.substring(0, 20)}...</p>
          <p><strong>What's Next:</strong></p>
          <ol>
            <li>Your old Telegram bot session is now invalid</li>
            <li>Use your new password to login via the Telegram bot</li>
            <li>All your wallet and trading data remains the same</li>
          </ol>
          <button onclick="testNewLogin('${orgId}', '${email}')">Test New Login</button>
          <button onclick="location.reload()">Return to Main</button>
        </div>
      `;
    }

  } catch (error) {
    console.error(' New key generation failed:', error);
    
    // Show error in UI
    document.getElementById('content').innerHTML = `
      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>❌ Key Generation Failed</h3>
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Please try the recovery process again or contact support.</p>
        <button onclick="window.recover()">Try Recovery Again</button>
        <button onclick="location.reload()">Return to Main</button>
      </div>
    `;
  }
}

// Test function to verify new login works
async function testNewLogin(orgId, email) {
  try {
    console.log('Testing new login...');
    
    const password = prompt('Enter your NEW password to test login:');
    if (!password) return;

    const apiKey = await window.EncryptionUtils.retrieveTelegramKey(password);
    
    document.getElementById('content').innerHTML = `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; margin: 10px 0; border-radius: 5px;">
        <h3>✅ Login Test Successful!</h3>
        <p>Your new password successfully decrypted your Telegram keys.</p>
        <p><strong>Public Key:</strong> ${apiKey.apiPublicKey.substring(0, 20)}...</p>
        <p>You can now use this password with the Telegram bot.</p>
        <button onclick="location.reload()">Return to Main</button>
      </div>
    `;

  } catch (error) {
    alert('Login test failed: ' + error.message);
  }
}
