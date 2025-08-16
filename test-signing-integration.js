// test-signing-integration.js - Test script for signing integration
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Sample XDR for testing (you'll need to replace with real XDR)
const SAMPLE_XDR = 'AAAAAgAAAABiSu3tAAAAAGJK7e0AAAAAAAAAAQAAAAAAAAABAAAAAGJK7e0AAAAA';

async function testPythonConnection() {
  console.log('🧪 Testing Python bot connection...');
  
  try {
    const response = await fetch(`${BASE_URL}/mini-app/test-python-connection`);
    const data = await response.json();
    
    console.log('✅ Python connection test result:', data);
    return data.success;
  } catch (error) {
    console.error('❌ Python connection test failed:', error.message);
    return false;
  }
}

async function testSigning() {
  console.log('🧪 Testing transaction signing...');
  
  try {
    const response = await fetch(`${BASE_URL}/mini-app/test-sign-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        xdr: SAMPLE_XDR,
        transaction_type: 'payment',
        include_fee: false
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Signing test successful!');
      console.log('📝 Signed XDR:', data.signed_xdr);
      console.log('🔗 Transaction Hash:', data.hash);
      console.log('💰 Fee:', data.fee);
      console.log('🔐 Signing Method:', data.signing_method);
      console.log('👤 Test User:', data.test_user);
    } else {
      console.log('❌ Signing test failed:', data);
    }
    
    return data.success;
  } catch (error) {
    console.error('❌ Signing test error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting integration tests...\n');
  
  // Test 1: Python connection
  const pythonConnected = await testPythonConnection();
  console.log('');
  
  if (pythonConnected) {
    // Test 2: Signing (only if Python is connected)
    await testSigning();
  } else {
    console.log('⚠️ Skipping signing test - Python bot not connected');
  }
  
  console.log('\n🏁 Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testPythonConnection, testSigning, runTests };
