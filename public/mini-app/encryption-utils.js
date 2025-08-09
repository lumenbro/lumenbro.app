// encryption-utils.js - Standardized encryption for all API key storage
window.EncryptionUtils = {
  
  // Encrypt private key with password (consistent format)
  async encryptPrivateKey(privateKey, password) {
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
      encryptedPrivateKey: Array.from(new Uint8Array(encryptedPrivateKey)),
      iv: Array.from(iv),
      salt: Array.from(salt)
    };
  },

  // Decrypt private key with password (consistent format)
  async decryptPrivateKey(encryptedData, password) {
    if (!encryptedData.encryptedPrivateKey || !encryptedData.iv || !encryptedData.salt) {
      throw new Error('Missing encryption data fields');
    }

    if (!Array.isArray(encryptedData.salt) || !Array.isArray(encryptedData.iv) || !Array.isArray(encryptedData.encryptedPrivateKey)) {
      throw new Error('Invalid encrypted data format');
    }

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: Uint8Array.from(encryptedData.salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    const decryptedPrivateKeyBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(encryptedData.iv) },
      derivedKey,
      Uint8Array.from(encryptedData.encryptedPrivateKey)
    );
    
    return new TextDecoder().decode(decryptedPrivateKeyBuffer);
  },

  // Store encrypted API key in Telegram Cloud Storage
  async storeTelegramKey(publicKey, privateKey, password) {
    const encryptionData = await this.encryptPrivateKey(privateKey, password);
    
    const storedData = {
      publicKey: publicKey,
      encryptedPrivateKey: encryptionData.encryptedPrivateKey,
      iv: encryptionData.iv,
      salt: encryptionData.salt
    };

    return new Promise((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.setItem('TURNKEY_API_KEY', JSON.stringify(storedData), (error) => {
        if (error) reject(new Error(`Cloud storage failed: ${error}`));
        else resolve(storedData);
      });
    });
  },

  // Retrieve and decrypt API key from Telegram Cloud Storage
  async retrieveTelegramKey(password) {
    const encryptedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });
    
    if (!encryptedData) {
      throw new Error('No stored key found');
    }

    console.log('Retrieved stored data format:', {
      hasPublicKey: !!encryptedData.publicKey,
      hasEncryptedPrivateKey: !!encryptedData.encryptedPrivateKey,
      hasIv: !!encryptedData.iv,
      hasSalt: !!encryptedData.salt,
      isLegacyFormat: !!(encryptedData.apiPublicKey && encryptedData.apiPrivateKey)
    });

    // Check for legacy unencrypted format
    if (encryptedData.apiPublicKey && encryptedData.apiPrivateKey) {
      throw new Error('Legacy unencrypted key detected - please re-register with password');
    }

    // Decrypt the private key
    const decryptedPrivateKey = await this.decryptPrivateKey(encryptedData, password);
    
    return {
      apiPublicKey: encryptedData.publicKey,
      apiPrivateKey: decryptedPrivateKey
    };
  },

  // Check if stored key is in encrypted format
  async isKeyEncrypted() {
    const storedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });
    
    if (!storedData) return false;
    
    // New encrypted format has these fields
    return !!(storedData.encryptedPrivateKey && storedData.iv && storedData.salt && storedData.publicKey);
  },

  // Migrate legacy key to encrypted format
  async migrateLegacyKey(password) {
    const storedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });
    
    if (!storedData || !storedData.apiPublicKey || !storedData.apiPrivateKey) {
      throw new Error('No legacy key found to migrate');
    }

    console.log('Migrating legacy key to encrypted format...');
    
    // Store in new encrypted format
    await this.storeTelegramKey(storedData.apiPublicKey, storedData.apiPrivateKey, password);
    
    console.log('✅ Legacy key migration complete');
    return true;
  }
};
