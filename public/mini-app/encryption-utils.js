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
    console.log('🔍 retrieveTelegramKey called with password length:', password ? password.length : 0);
    
    const encryptedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        console.log('🔍 Cloud storage getItem result:', { error, hasValue: !!value });
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
      isLegacyFormat: !!(encryptedData.apiPublicKey && encryptedData.apiPrivateKey),
      keys: Object.keys(encryptedData),
      data: encryptedData
    });

    // Check for legacy unencrypted format - handle these directly
    if (encryptedData.apiPublicKey && encryptedData.apiPrivateKey) {
      console.log('⚠️ Legacy keys detected - using plaintext keys directly');
      return {
        apiPublicKey: encryptedData.apiPublicKey,
        apiPrivateKey: encryptedData.apiPrivateKey
      };
    }

    // For encrypted format, password is required
    console.log('🔍 Checking password requirement:', { hasPassword: !!password, passwordLength: password ? password.length : 0 });
    if (!password) {
      throw new Error('Password required for encrypted keys');
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

  // Migrate legacy plaintext key (apiPublicKey/apiPrivateKey) to encrypted format
  async migrateLegacyKey(password) {
    if (!password) {
      throw new Error('Password required to migrate legacy key');
    }

    // Read existing stored value
    const legacyData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });

    if (!legacyData) {
      throw new Error('No stored key to migrate');
    }

    // If already encrypted, do nothing
    if (legacyData.encryptedPrivateKey && legacyData.iv && legacyData.salt && legacyData.publicKey) {
      return legacyData;
    }

    // Validate legacy plaintext format
    if (!legacyData.apiPublicKey || !legacyData.apiPrivateKey) {
      throw new Error('Invalid legacy key format');
    }

    // Backup legacy record for safety
    await new Promise((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.setItem(
        'TURNKEY_API_KEY_BACKUP',
        JSON.stringify(legacyData),
        (error) => (error ? reject(new Error(`Backup failed: ${error}`)) : resolve())
      );
    });

    // Encrypt the private key with the provided password
    const encryptionData = await this.encryptPrivateKey(legacyData.apiPrivateKey, password);

    const newStoredData = {
      publicKey: legacyData.apiPublicKey,
      encryptedPrivateKey: encryptionData.encryptedPrivateKey,
      iv: encryptionData.iv,
      salt: encryptionData.salt
    };

    // Store the migrated encrypted record
    await new Promise((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.setItem(
        'TURNKEY_API_KEY',
        JSON.stringify(newStoredData),
        (error) => (error ? reject(new Error(`Cloud storage failed: ${error}`)) : resolve())
      );
    });

    return newStoredData;
  },


};
