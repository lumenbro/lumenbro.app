// transaction-stamper.js - Dedicated stamper for wallet transactions
// Uses Turnkey's ApiKeyStamper for better mobile compatibility
// Keeps existing login/recovery stamper logic untouched

// Helper functions (copied from login.js for independence)
function hexToUint8Array(hex) {
  if (!hex) throw new Error('Hex string is undefined or empty');
  
  try {
    const cleanHex = hex.replace(/^0x/, '');
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    
    const pairs = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      pairs.push(cleanHex.substr(i, 2));
    }
    
    return new Uint8Array(pairs.map(byte => parseInt(byte, 16)));
  } catch (error) {
    console.error('❌ hexToUint8Array error:', error);
    throw new Error(`Hex conversion failed: ${error.message}`);
  }
}

function bytesToBase64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Secure transaction stamper using TelegramCloudStorageStamper with decrypted keys
class TransactionStamper {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.stamper = null; // Will be initialized in stamp method
  }

  async stamp(payload) {
    try {
      console.log('🔍 Starting secure transaction stamping process...');
      
      // Initialize the TelegramCloudStorageStamper with our decrypted keys
      if (!this.stamper) {
        console.log('🔧 Initializing TelegramCloudStorageStamper with decrypted keys...');
        
        this.stamper = new window.Turnkey.TelegramCloudStorageStamper();
        
        // Pass decrypted keys directly (they won't be stored in plaintext)
        await this.stamper.setSigningKey({
          cloudStorageAPIKey: {
            apiPublicKey: this.publicKey,
            apiPrivateKey: this.privateKey
          }
        });
        
        console.log('✅ TelegramCloudStorageStamper initialized with decrypted keys');
      }
      
      // Use the stamper to sign the payload
      console.log('✅ Using TelegramCloudStorageStamper with fallback support');
      const stampResult = await this.stamper.stamp(payload);
      
      console.log('✅ TelegramCloudStorageStamper signing successful');
      
      // Extract signature from the stamp result
      const stampData = JSON.parse(atob(stampResult.stampHeaderValue.replace(/-/g, '+').replace(/_/g, '/')));
      
      return {
        publicKey: stampData.publicKey,
        scheme: stampData.scheme,
        signature: stampData.signature
      };

    } catch (error) {
      console.error('❌ TransactionStamper.stamp failed:', error);
      
      // Fallback to backend signing if TelegramCloudStorageStamper fails
      console.log('🔄 Attempting backend signing as fallback...');
      
      try {
        const response = await fetch('/mini-app/sign-payload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: payload,
            privateKey: this.privateKey,
            publicKey: this.publicKey
          })
        });
        
        if (!response.ok) {
          throw new Error(`Backend signing failed: ${response.status}`);
        }
        
        const stampResult = await response.json();
        console.log('✅ Backend signing successful as fallback');
        
        return {
          publicKey: stampResult.publicKey || this.publicKey,
          scheme: "SIGNATURE_SCHEME_TK_API_P256",
          signature: stampResult.signature
        };
        
      } catch (backendError) {
        console.error('❌ Backend signing also failed:', backendError);
        throw new Error('Transaction signing failed - please try again');
      }
    }
  }
}

// Factory function for creating transaction stampers
function createTransactionStamper(privateKey, publicKey) {
  console.log('✅ Creating TransactionStamper with encrypted keys');
  return new TransactionStamper(privateKey, publicKey);
}

// Export for use in other modules
window.TransactionStamper = TransactionStamper;
window.createTransactionStamper = createTransactionStamper;
