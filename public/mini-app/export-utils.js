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
       // For Stellar, the private key should be 32 bytes (64 hex chars)
       // S-address format is typically just the hex private key with 'S' prefix
       const stellarSAddress = 'S' + stellarPrivateKey;
       console.log('📋 Stellar S-address:', stellarSAddress.substring(0, 20) + '...');
       console.log('📋 Stellar S-address length:', stellarSAddress.length);
       
       // Test if the private key works with Stellar SDK
       try {
         // Import Stellar SDK dynamically
         const { Keypair } = await import('https://cdn.skypack.dev/@stellar/stellar-sdk');
         const keypair = Keypair.fromSecret(stellarPrivateKey);
         console.log('✅ Stellar keypair created successfully');
         console.log('✅ Public key:', keypair.publicKey());
         console.log('✅ Private key valid for Stellar');
       } catch (stellarError) {
         console.error('❌ Stellar keypair creation failed:', stellarError);
         console.error('❌ This suggests the private key format is incorrect');
       }
      
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

Stellar Private Key (Hex):
${stellarPrivateKey}

Stellar S-Address:
${stellarSAddress}

Stellar Public Address:
${stellarAddress}

Instructions:
1. Import the private key into any Stellar wallet
2. The S-address format can be used in some wallets
3. Keep this backup safe - anyone with the private key can access your funds
4. Never share this file with anyone

Generated by LumenBro Mini App
`;
  }
}

// Make available globally
window.ExportUtils = ExportUtils;
