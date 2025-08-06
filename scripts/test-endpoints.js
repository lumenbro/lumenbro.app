const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/charts';

async function testEndpoints() {
  console.log('🧪 Testing Chart API Endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health:', health.data);
    console.log('');

    // Test 2: Popular pairs
    console.log('2. Testing popular pairs...');
    const popular = await axios.get(`${BASE_URL}/popular`);
    console.log('✅ Popular pairs:', popular.data);
    console.log('');

    // Test 3: Single chart data (XLM/USDC 1h)
    console.log('3. Testing single chart data...');
    const params = new URLSearchParams({
      baseAsset: JSON.stringify({ isNative: true }),
      counterAsset: JSON.stringify({ 
        isNative: false, 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' 
      }),
      resolution: '1h',
      hours: '24'
    });
    
    const single = await axios.get(`${BASE_URL}/single?${params}`);
    console.log('✅ Single chart data:', {
      success: single.data.success,
      dataLength: single.data.data?.length || 0,
      pair: single.data.pair
    });
    console.log('');

    // Test 4: Sync status
    console.log('4. Testing sync status...');
    const syncStatus = await axios.get(`${BASE_URL}/sync-status`);
    console.log('✅ Sync status:', syncStatus.data);
    console.log('');

    // Test 5: All tracked pairs
    console.log('5. Testing all pairs...');
    const pairs = await axios.get(`${BASE_URL}/pairs`);
    console.log('✅ All pairs:', pairs.data);
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  testEndpoints();
}

module.exports = { testEndpoints }; 