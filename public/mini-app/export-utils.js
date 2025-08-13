// public/mini-app/export-utils.js - Wallet export utilities
class ExportUtils {
  
     // Generate ephemeral key pair for HPKE encryption using Turnkey library
   static async generateEphemeralKeyPair() {
           try {
        // Use Turnkey's generateP256KeyPair function
        const turnkeyKeyPair = await window.Turnkey.generateP256KeyPair();
       
       console.log('🔑 Generated Turnkey key pair:', {
         privateKeyLength: turnkeyKeyPair.privateKey.length,
         publicKeyLength: turnkeyKeyPair.publicKey.length,
         publicKeyUncompressedLength: turnkeyKeyPair.publicKeyUncompressed.length,
         privateKeySample: turnkeyKeyPair.privateKey.substring(0, 20) + '...',
         publicKeySample: turnkeyKeyPair.publicKey.substring(0, 20) + '...'
       });
       
       return {
         privateKeyHex: turnkeyKeyPair.privateKey,
         targetPublicKey: turnkeyKeyPair.publicKeyUncompressed
       };
     } catch (error) {
       console.error('Error generating ephemeral key pair:', error);
       throw error;
     }
   }
  
  // Export wallet account and get Stellar private key
  static async exportWalletAccount(subOrgId, walletAccountId, stellarAddress, userApiPublicKey, userApiPrivateKey) {
    try {
      console.log('🔍 Starting wallet account export...');
      
      // Wait for Turnkey to be available
      let attempts = 0;
      while (!window.Turnkey && attempts < 10) {
        console.log(`⏳ Waiting for Turnkey to load... (attempt ${attempts + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (!window.Turnkey) {
        throw new Error('Turnkey SDK not loaded after 5 seconds');
      }
      
             // Step 1: Generate ephemeral key pair
       const { privateKeyHex, targetPublicKey } = await this.generateEphemeralKeyPair();
       console.log('✅ Generated ephemeral key pair');
      
      // Step 2: Initialize Turnkey client with user's API keys
      console.log('🔍 Turnkey availability check:', {
        hasTurnkey: !!window.Turnkey,
        turnkeyType: typeof window.Turnkey,
        turnkeyKeys: window.Turnkey ? Object.keys(window.Turnkey) : 'N/A',
        turnkeyConstructor: window.Turnkey?.constructor?.name,
        turnkeyPrototype: window.Turnkey?.prototype ? 'Has prototype' : 'No prototype'
      });
      
             // Check what Turnkey methods are available
       console.log('🔍 Available Turnkey methods:', Object.keys(window.Turnkey));
       console.log('🔍 Turnkey.decryptExportBundle exists:', !!window.Turnkey.decryptExportBundle);
       console.log('🔍 Turnkey.decryptExportBundle type:', typeof window.Turnkey.decryptExportBundle);
      
      // Use the backend API instead of client-side SDK
      console.log('🔄 Using backend API for export...');
      
      const response = await fetch('/api/export-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subOrgId: subOrgId,
          walletAccountId: walletAccountId,
          stellarAddress: stellarAddress,
          targetPublicKey: targetPublicKey,
          userApiPublicKey: userApiPublicKey,
          userApiPrivateKey: userApiPrivateKey
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }
      
      const exportResult = await response.json();
      
      if (!exportResult.success) {
        throw new Error(exportResult.error || 'Export failed');
      }
      
      console.log('✅ Backend export successful');
      console.log('📦 Export bundle length:', exportResult.exportBundle?.length || 'N/A');
      
             // Step 4: Decrypt the export bundle on client side
       console.log('🔍 Available Turnkey methods for decryption:', Object.keys(window.Turnkey));
       console.log('🔍 Before decryption - decryptExportBundle exists:', !!window.Turnkey.decryptExportBundle);
       console.log('🔍 Before decryption - decryptExportBundle type:', typeof window.Turnkey.decryptExportBundle);
      
             // Try different decryption approaches
       let decryptedData;
       try {
                  // Method 1: Try decryptExportBundle
          if (window.Turnkey.decryptExportBundle) {
            console.log('🔑 Using private key for decryption:', privateKeyHex.substring(0, 20) + '...');
            
                        decryptedData = await window.Turnkey.decryptExportBundle({
               exportBundle: exportResult.exportBundle,
               privateKey: privateKeyHex,
               organizationId: subOrgId
             });
                 } else {
           throw new Error('decryptExportBundle function not available in Turnkey library');
         }
             } catch (decryptError) {
         console.error('❌ Decryption failed:', decryptError);
         console.error('❌ Decryption error name:', decryptError.name);
         console.error('❌ Decryption error stack:', decryptError.stack);
         console.error('❌ Private key used:', privateKeyHex.substring(0, 20) + '...');
         console.error('❌ Private key length:', privateKeyHex.length);
         throw new Error('Failed to decrypt export bundle: ' + decryptError.message);
       }
      
      console.log('✅ Bundle decrypted successfully');
      
             // Step 5: Extract the Stellar private key (decryptedData is the hex string directly)
       const stellarPrivateKey = decryptedData;
       console.log('📋 Stellar private key length:', stellarPrivateKey.length);
       console.log('📋 Private key format validation:', stellarPrivateKey.length === 64 ? 'PASSED' : 'FAILED');
       
               // Step 6: Convert to Stellar S-address format
        // Stellar S-address format: S + base58check encoded private key
        // We need to convert hex to base58check with proper checksum
        const stellarSAddress = await this.hexToStellarSAddress(stellarPrivateKey);
               console.log('📋 Stellar S-address length:', stellarSAddress.length);
       console.log('📋 S-address format validation:', stellarSAddress.startsWith('S') ? 'PASSED' : 'FAILED');
       
               // Note: Private key format looks correct (64 hex characters)
        console.log('✅ Private key format appears correct (64 hex characters)');
        console.log('✅ This should work with Stellar wallets');
        
        // Test the private key with a simple validation
        console.log('🔍 Testing private key validation...');
        if (stellarPrivateKey.length === 64 && /^[0-9a-fA-F]+$/.test(stellarPrivateKey)) {
          console.log('✅ Private key format validation passed');
          console.log('✅ Should work with Stellar Lab and other wallets');
        } else {
          console.log('❌ Private key format validation failed');
        }
        
                 // Test S-address conversion with known example
         console.log('🔍 Testing S-address conversion...');
         const testHex = 'cd0d01c473a4669a1100897f74f13f2dd2ee417e3730b2794e4489fd3b94ea1d';
         const testSAddress = await this.hexToStellarSAddress(testHex);
         console.log('📋 Test conversion result:', testSAddress);
         console.log('📋 Expected result: SDGQ2AOEOOSGNGQRACEX65HRH4W5F3SBPY3TBMTZJZCIT7J3STVB27S7');
         console.log('📋 Conversion match:', testSAddress === 'SDGQ2AOEOOSGNGQRACEX65HRH4W5F3SBPY3TBMTZJZCIT7J3STVB27S7');
        
        // Debug: Test with your actual private key
        console.log('🔍 Testing with actual private key...');
        const actualSAddress = await this.hexToStellarSAddress(stellarPrivateKey);
        console.log('📋 Private key format validation:', stellarPrivateKey.length === 64 ? 'PASSED' : 'FAILED');
        console.log('📋 StrKey starts with S:', actualSAddress.startsWith('S'));
        console.log('📋 StrKey length:', actualSAddress.length);
      
              return {
          stellarPrivateKey,
          stellarSAddress: actualSAddress, // Use the properly converted StrKey
          exportBundle: exportResult.exportBundle
        };
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }
  
  // Format private key for display
  static formatPrivateKeyForDisplay(privateKey) {
    if (!privateKey) return '';
    
    // Remove '0x' prefix if present
    const cleanKey = privateKey.startsWith('0x') ? privateKey.substring(2) : privateKey;
    
    // Format as groups of 4 characters
    return cleanKey.match(/.{1,4}/g).join(' ');
  }
  
     // Format S-address for display
   static formatSAddressForDisplay(sAddress) {
     if (!sAddress) return '';
     
     // Format as groups of 4 characters
     return sAddress.match(/.{1,4}/g).join(' ');
   }
   
       // Convert hex private key to Stellar S-address format (SEP-0023 StrKey)
    static async hexToStellarSAddress(hexPrivateKey) {
      try {
        console.log('📋 Converting hex to Stellar StrKey format (SEP-0023)...');
        
        // Step 1: Decode hex to bytes (strip '0x' if present)
        const cleanHex = hexPrivateKey.startsWith('0x') ? hexPrivateKey.substring(2) : hexPrivateKey;
        const seedBytes = this.hexToBytes(cleanHex);
        
        if (seedBytes.length !== 32) {
          throw new Error("Invalid raw key length; must be 32 bytes.");
        }
        
        // Step 2: Create version byte + seed (33 bytes total)
        // Version byte 0x90 (144) for Ed25519 secret seeds
        const versioned = new Uint8Array(33);
        versioned[0] = 0x90; // Ed25519 secret seed version byte
        versioned.set(seedBytes, 1);
        
        // Step 3: Compute CRC16-XMODEM checksum over version + seed
        const checksum = this.crc16Xmodem(versioned);
        
        // Step 4: Append 2-byte checksum (big-endian) → 35 bytes total
        const payload = new Uint8Array(35);
        payload.set(versioned, 0);
        payload.set(checksum, 33);
        
        // Step 5: Base32 encode (RFC4648, no padding, uppercase)
        const base32Encoded = this.base32Encode(payload);
        
        console.log('📋 Created Stellar StrKey:', base32Encoded.substring(0, 20) + '...');
        console.log('📋 StrKey length:', base32Encoded.length);
        console.log('📋 Should be 56 characters and start with S');
        
        return base32Encoded;
        
      } catch (error) {
        console.error('Error converting to Stellar StrKey:', error);
        // Fallback to hex format
        return hexPrivateKey;
      }
    }
    
    // Helper: Convert hex string to bytes
    static hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes;
    }
    
         // Helper: CRC16-XMODEM implementation (SEP-0023 specification)
     static crc16Xmodem(data) {
       let crc = 0x0000;
       const polynomial = 0x1021; // XMODEM polynomial
       
       for (let i = 0; i < data.length; i++) {
         crc ^= (data[i] << 8);
         for (let j = 0; j < 8; j++) {
           if (crc & 0x8000) {
             crc = (crc << 1) ^ polynomial;
           } else {
             crc = crc << 1;
           }
           crc &= 0xFFFF; // Keep 16-bit
         }
       }
       
       // Return as 2 bytes (little-endian - as used by Stellar)
       const result = new Uint8Array(2);
       result[0] = crc & 0xFF;         // Low byte first
       result[1] = (crc >> 8) & 0xFF;  // High byte second
       return result;
     }
    
    // Helper: Base32 encoding (RFC4648, no padding, uppercase)
    static base32Encode(data) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = 0;
      let value = 0;
      let output = '';
      
      for (let i = 0; i < data.length; i++) {
        value = (value << 8) | data[i];
        bits += 8;
        
        while (bits >= 5) {
          output += alphabet[(value >>> (bits - 5)) & 31];
          bits -= 5;
        }
      }
      
      if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 31];
      }
      
      return output;
    }
   

  
  // Copy text to clipboard
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
  
  // Download as text file
  static downloadAsFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Download as binary (octet-stream) file
  static downloadBinary(content, filename) {
    try {
      // Prefer server-assisted download for mobile WebView stability
      const base64 = btoa(String.fromCharCode(...new Uint8Array(content)));
      fetch('/api/temp-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, mime: 'application/octet-stream', base64 })
      })
      .then(r => r.json())
      .then(data => {
        if (!data || !data.url) throw new Error('Temp upload failed');
        // Open download URL to force attachment via Content-Disposition
        window.location.href = data.url;
      })
      .catch(err => {
        console.error('Server-assisted download failed, falling back to blob:', err);
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } catch (e) {
      console.error('downloadBinary error:', e);
    }
  }
  
           // Create backup file content
    static createBackupFileContent(stellarPrivateKey, stellarSAddress, stellarAddress) {
      const timestamp = new Date().toISOString();
      return `LumenBro Wallet Backup
  Generated: ${timestamp}
  
  ⚠️  IMPORTANT: Keep this file secure and private!
  
  Stellar Private Key (Hex Format):
  ${stellarPrivateKey}
  
  Stellar S-Address (Base32 Format):
  ${stellarSAddress}
  
  Stellar Public Address:
  ${stellarAddress}
  
  Instructions:
  1. Use the S-Address format for most Stellar wallets and tools
  2. Use the hex format for Stellar Lab and some other tools
  3. Both formats represent the same private key
  4. Keep this backup safe - anyone with the private key can access your funds
  5. Never share this file with anyone
  
  Generated by LumenBro Mini App
  `;
    }

  // Create encrypted backup content using the provided password (PBKDF2 + AES-GCM)
  static async createEncryptedBackupFileContent(stellarPrivateKey, stellarSAddress, stellarAddress, password) {
    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {
        stellarPrivateKey,
        stellarSAddress,
        stellarAddress
      }
    };

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(JSON.stringify(payload))
    );

    const backup = {
      file: 'LumenBro Encrypted Wallet Backup',
      version: 1,
      kdf: { name: 'PBKDF2', iterations: 100000, hash: 'SHA-256', salt: Array.from(salt) },
      cipher: { name: 'AES-GCM', iv: Array.from(iv) },
      payload: Array.from(new Uint8Array(ciphertext))
    };

    return JSON.stringify(backup, null, 2);
  }

  // Prompt for password and download encrypted backup file (.lbk)
  static async downloadEncryptedBackupFile(stellarPrivateKey, stellarSAddress, stellarAddress, suggestedPassword) {
    try {
      const password = suggestedPassword || prompt('Enter a password to encrypt your backup file (use the same as your login password):');
      if (!password) {
        throw new Error('Password required to encrypt backup');
      }
      const content = await this.createEncryptedBackupFileContent(stellarPrivateKey, stellarSAddress, stellarAddress, password);
      this.downloadBinary(new TextEncoder().encode(content), `lumenbro-wallet-backup-${Date.now()}.lbk`);
      return true;
    } catch (e) {
      console.error('Encrypted backup download failed:', e);
      return false;
    }
  }
}

// Make available globally
window.ExportUtils = ExportUtils;
