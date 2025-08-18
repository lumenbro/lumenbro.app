console.log('Testing Stellar SDK...');

try {
  const { Keypair, Networks } = require('@stellar/stellar-sdk');
  console.log('✅ Stellar SDK loaded successfully!');
  
  // Test basic functionality
  const keypair = Keypair.random();
  console.log('✅ Keypair generation works:', keypair.publicKey());
  console.log('✅ Network passphrase:', Networks.PUBLIC);
  
} catch (error) {
  console.error('❌ Stellar SDK error:', error.message);
  console.error('Stack:', error.stack);
}
