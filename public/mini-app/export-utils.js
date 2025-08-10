// public/mini-app/export-utils.js - Wallet export utilities
class ExportUtils {
  
  // Generate ephemeral key pair for HPKE encryption
  static async generateEphemeralKeyPair() {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey']
      );
      
      const publicKey = await window.crypto.subtle.exportKey(
        'raw',
        keyPair.publicKey
      );
      
      // Convert to hex format (uncompressed P-256 public key)
      const targetPublicKey = '04' + Array.from(new Uint8Array(publicKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return {
        keyPair,
        targetPublicKey
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
      const { keyPair, targetPublicKey } = await this.generateEphemeralKeyPair();
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
      const decryptedData = await window.Turnkey.decryptExportBundle({
        exportBundle: exportResult.exportBundle,
        privateKey: keyPair.privateKey
      });
      
      console.log('✅ Bundle decrypted successfully');
      
      // Step 5: Extract the Stellar private key
      const stellarPrivateKey = decryptedData.privateKey;
      console.log('📋 Stellar private key (hex):', stellarPrivateKey.substring(0, 20) + '...');
      
      // Step 6: Convert to Stellar S-address format
      const stellarSAddress = 'S' + stellarPrivateKey.substring(2); // Remove '0x' prefix and add 'S'
      
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
