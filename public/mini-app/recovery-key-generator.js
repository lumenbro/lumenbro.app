// recovery-key-generator.js - Handles generating new Telegram API keys after recovery

class RecoveryKeyGenerator {
  constructor() {
    this.credentials = null;
  }

  // Set the recovery credentials from OTP verification
  setRecoveryCredentials(credentials) {
    this.credentials = credentials;
    console.log('🔑 Recovery credentials set:', {
      orgId: credentials.orgId,
      email: credentials.email,
      expiresAt: new Date(credentials.expiresAt).toISOString()
    });
  }

  // Generate new Telegram API keys using recovery credentials
  async generateNewTelegramKey(password) {
    if (!this.credentials) {
      throw new Error('No recovery credentials available. Complete OTP verification first.');
    }

    if (Date.now() > this.credentials.expiresAt) {
      throw new Error('Recovery credentials have expired. Please start recovery again.');
    }

    try {
      console.log('🔄 Generating new Telegram API key...');
      
      // Generate new P256 keypair for API keys
      const newKeyPair = await window.Turnkey.generateP256ApiKeyPair();
      
      console.log('✅ Generated new API key pair');
      
      // Use recovery credentials to create new API key in Turnkey via backend
      console.log('🔗 Creating new API key via backend...');
      
      const createKeyResponse = await fetch('/create-recovery-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.credentials.email,
          orgId: this.credentials.orgId,
          publicKey: newKeyPair.publicKey,
          apiKeyName: `Recovery Telegram Key - ${this.credentials.email}`
        })
      });

      if (!createKeyResponse.ok) {
        const errorData = await createKeyResponse.json();
        throw new Error(errorData.error || 'Failed to create API key via backend');
      }

      const newApiKeyResponse = await createKeyResponse.json();

      console.log('✅ Created new API key in Turnkey:', newApiKeyResponse);

      // Encrypt and store the new keys in Telegram Cloud Storage
      const encryptedData = await this.encryptKeyWithPassword(newKeyPair, password);
      
      // Store in Telegram Cloud Storage
      await this.storeTelegramKey(encryptedData);
      
      console.log('✅ New encrypted keys stored in Telegram Cloud');
      
      return {
        success: true,
        apiKeyId: newApiKeyResponse.apiKeyId,
        publicKey: newKeyPair.publicKey,
        encrypted: true
      };

    } catch (error) {
      console.error('❌ Failed to generate new Telegram key:', error);
      throw new Error(`Failed to create new API key: ${error.message}`);
    }
  }

  // Encrypt private key with password (uses same method as EncryptionUtils)
  async encryptKeyWithPassword(keyPair, password) {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from password
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Encrypt private key
    const privateKeyData = encoder.encode(keyPair.privateKey);
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      privateKeyData
    );
    
    return {
      publicKey: keyPair.publicKey,
      encryptedPrivateKey: Array.from(new Uint8Array(encryptedData)),
      iv: Array.from(iv),
      salt: Array.from(salt)
    };
  }

  // Store encrypted data in Telegram Cloud Storage
  async storeTelegramKey(encryptedData) {
    return new Promise((resolve, reject) => {
      const dataToStore = JSON.stringify(encryptedData);
      
      window.Telegram.WebApp.CloudStorage.setItem('TURNKEY_API_KEY', dataToStore, (error) => {
        if (error) {
          reject(new Error(`Failed to store in Telegram Cloud: ${error}`));
        } else {
          resolve(encryptedData);
        }
      });
    });
  }

  // Get current recovery status
  getRecoveryStatus() {
    if (!this.credentials) {
      return { status: 'no_credentials', message: 'No recovery session active' };
    }
    
    if (Date.now() > this.credentials.expiresAt) {
      return { status: 'expired', message: 'Recovery session expired' };
    }
    
    return { 
      status: 'active', 
      message: 'Recovery session active',
      orgId: this.credentials.orgId,
      email: this.credentials.email,
      expiresIn: Math.floor((this.credentials.expiresAt - Date.now()) / 1000 / 60) // minutes
    };
  }
}

// Make available globally
window.recoveryKeyGenerator = new RecoveryKeyGenerator();

// Export for standalone use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecoveryKeyGenerator;
}