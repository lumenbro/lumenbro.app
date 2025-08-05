require('dotenv').config();
const KMSService = require('../services/kmsService');

async function testKMSIntegration() {
  console.log('🧪 Testing KMS Integration...');
  
  const kmsService = new KMSService();
  
  try {
    // Test connection
    console.log('1. Testing KMS connection...');
    const connectionOk = await kmsService.testConnection();
    if (!connectionOk) {
      console.error('❌ KMS connection failed');
      return;
    }
    console.log('✅ KMS connection successful');
    
    // Test encryption/decryption
    console.log('2. Testing encryption/decryption...');
    const testPublicKey = '03a6e9853ed0d0ac91ae7aff7d06e9ac5956c9a3c0fe80693352ca64cbedbf3637';
    const testPrivateKey = '81eac996e612f8876dbd34f0d22056c001f8b0f70c4cc458d37dcd5b1e56f311';
    
    // Encrypt
    const { encryptedData, keyId } = await kmsService.encryptSessionKeys(testPublicKey, testPrivateKey);
    console.log('✅ Encryption successful');
    console.log(`   Key ID: ${keyId}`);
    console.log(`   Encrypted data length: ${encryptedData.length} characters`);
    
    // Decrypt
    const decryptedKeys = await kmsService.decryptSessionKeys(encryptedData, keyId);
    console.log('✅ Decryption successful');
    
    // Verify
    if (decryptedKeys.publicKey === testPublicKey && decryptedKeys.privateKey === testPrivateKey) {
      console.log('✅ Encryption/decryption verification successful');
    } else {
      console.error('❌ Encryption/decryption verification failed');
      console.log('Original:', { publicKey: testPublicKey, privateKey: testPrivateKey });
      console.log('Decrypted:', decryptedKeys);
    }
    
    console.log('\n🎉 KMS integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ KMS integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test if executed directly
if (require.main === module) {
  testKMSIntegration();
}

module.exports = { testKMSIntegration }; 