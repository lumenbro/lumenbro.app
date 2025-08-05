const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
const testPair = {
  baseAsset: { isNative: true },
  counterAsset: { isNative: false, code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' }
};

const testPairs = [
  {
    baseAsset: { isNative: true },
    counterAsset: { isNative: false, code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' },
    resolution: '1h',
    hours: 24
  },
  {
    baseAsset: { isNative: true },
    counterAsset: { isNative: false, code: 'USDT', issuer: 'GCQTGZQQ5G4PTM2GLRNCDOTK3DJPJ6JKQIMWZXYGEW3C2I44F7XLVTNR' },
    resolution: '1h',
    hours: 24
  }
];

async function testHealthCheck() {
  console.log('Testing health check...');
  try {
    const response = await axios.get(`${BASE_URL}/api/charts/health`);
    console.log('✓ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
    return false;
  }
}

async function testSingleChart() {
  console.log('\nTesting single chart endpoint...');
  try {
    const params = {
      baseAsset: JSON.stringify(testPair.baseAsset),
      counterAsset: JSON.stringify(testPair.counterAsset),
      resolution: '1h',
      hours: 24
    };
    
    const response = await axios.get(`${BASE_URL}/api/charts/single`, { params });
    console.log('✓ Single chart test passed');
    console.log(`  Data points: ${response.data.data.length}`);
    return true;
  } catch (error) {
    console.error('✗ Single chart test failed:', error.message);
    return false;
  }
}

async function testBatchChart() {
  console.log('\nTesting batch chart endpoint...');
  try {
    const response = await axios.post(`${BASE_URL}/api/charts/batch`, {
      pairs: testPairs
    });
    console.log('✓ Batch chart test passed');
    console.log(`  Results: ${response.data.count}`);
    return true;
  } catch (error) {
    console.error('✗ Batch chart test failed:', error.message);
    return false;
  }
}

async function testPopularPairs() {
  console.log('\nTesting popular pairs endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/api/charts/popular?limit=5`);
    console.log('✓ Popular pairs test passed');
    console.log(`  Pairs: ${response.data.count}`);
    return true;
  } catch (error) {
    console.error('✗ Popular pairs test failed:', error.message);
    return false;
  }
}

async function testSyncStatus() {
  console.log('\nTesting sync status endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/api/charts/sync-status`);
    console.log('✓ Sync status test passed');
    console.log(`  Sync records: ${response.data.count}`);
    return true;
  } catch (error) {
    console.error('✗ Sync status test failed:', error.message);
    return false;
  }
}

async function testWebSocket() {
  console.log('\nTesting WebSocket connection...');
  try {
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://localhost:3000`);
    
    return new Promise((resolve) => {
      ws.on('open', () => {
        console.log('✓ WebSocket connection established');
        
        // Test subscription
        ws.send(JSON.stringify({
          type: 'subscribe',
          pair: testPair,
          resolution: '1h'
        }));
        
        setTimeout(() => {
          ws.close();
          resolve(true);
        }, 2000);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'connected') {
          console.log('✓ WebSocket connected message received');
        } else if (message.type === 'subscribed') {
          console.log('✓ WebSocket subscription confirmed');
        }
      });
      
      ws.on('error', (error) => {
        console.error('✗ WebSocket error:', error.message);
        resolve(false);
      });
      
      setTimeout(() => {
        console.error('✗ WebSocket connection timeout');
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.error('✗ WebSocket test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting API tests...\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Single Chart', fn: testSingleChart },
    { name: 'Batch Chart', fn: testBatchChart },
    { name: 'Popular Pairs', fn: testPopularPairs },
    { name: 'Sync Status', fn: testSyncStatus },
    { name: 'WebSocket', fn: testWebSocket }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }
  
  console.log('\n=== Test Results ===');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✓' : '✗';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  testHealthCheck,
  testSingleChart,
  testBatchChart,
  testPopularPairs,
  testSyncStatus,
  testWebSocket,
  runAllTests
}; 