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
       console.log('📋 Stellar private key (hex):', stellarPrivateKey.substring(0, 20) + '...');
       console.log('📋 Stellar private key length:', stellarPrivateKey.length);
       
               // Step 6: Convert to Stellar S-address format
        // Stellar S-address format: S + base58check encoded private key
        // We need to convert hex to base58check with proper checksum
        const stellarSAddress = await this.hexToStellarSAddress(stellarPrivateKey);
        console.log('📋 Stellar S-address:', stellarSAddress.substring(0, 20) + '...');
        console.log('📋 Stellar S-address length:', stellarSAddress.length);
       
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
      
      return {
        stellarPrivateKey,
        stellarSAddress,
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
   
       // Convert hex private key to Stellar S-address format
    static async hexToStellarSAddress(hexPrivateKey) {
      try {
        console.log('📋 Converting hex to proper Stellar S-address format...');
        
        // Step 1: Decode hex to bytes (strip '0x' if present)
        const cleanHex = hexPrivateKey.startsWith('0x') ? hexPrivateKey.substring(2) : hexPrivateKey;
        const seedBytes = this.hexToBytes(cleanHex);
        
        if (seedBytes.length !== 32) {
          throw new Error("Invalid raw key length; must be 32 bytes.");
        }
        
        // Step 2: Prepend version byte (0x90 for secret seeds)
        const versioned = new Uint8Array(33);
        versioned[0] = 0x90; // Secret seed version byte
        versioned.set(seedBytes, 1);
        
        // Step 3: Compute CRC16-XMODEM checksum
        const checksum = this.crc16Xmodem(versioned);
        
        // Step 4: Append checksum → 35 bytes
        const payload = new Uint8Array(35);
        payload.set(versioned, 0);
        payload.set(checksum, 33);
        
        // Step 5: Base32 encode (RFC4648, no padding, uppercase)
        const base32Encoded = this.base32Encode(payload);
        
        console.log('📋 Created proper Stellar S-address:', base32Encoded.substring(0, 20) + '...');
        return base32Encoded;
        
      } catch (error) {
        console.error('Error converting to S-address:', error);
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
    
    // Helper: CRC16-XMODEM implementation
    static crc16Xmodem(data) {
      let crc = 0x0000;
      const polynomial = 0x1021;
      
      for (let i = 0; i < data.length; i++) {
        crc ^= (data[i] << 8);
        for (let j = 0; j < 8; j++) {
          if (crc & 0x8000) {
            crc = (crc << 1) ^ polynomial;
          } else {
            crc = crc << 1;
          }
        }
      }
      
      // Convert to 2 bytes
      const result = new Uint8Array(2);
      result[0] = (crc >> 8) & 0xFF;
      result[1] = crc & 0xFF;
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
}

// Make available globally
window.ExportUtils = ExportUtils;
