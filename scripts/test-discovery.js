require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://lumenbro.app/api/charts' 
  : 'http://localhost:3000/api/charts';

// Test pairs to discover
const TEST_PAIRS = [
  {
    name: 'XLM/USDT',
    baseAsset: { isNative: true },
    counterAsset: {
      isNative: false,
      code: 'USDT',
      issuer: 'GCQTGZQQ5G4PTM2GLINCLQXZMG6MULN9773CZYQZCBQK2YTQMZYLPQWD'
    }
  },
  {
    name: 'XLM/BTC',
    baseAsset: { isNative: true },
    counterAsset: {
      isNative: false,
      code: 'BTC',
      issuer: 'GATEMHCCM7ZABHDBTHWXUZCSZIVJFJD5HYH5GKXELD2XJJGHBR6LETT3'
    }
  },
  {
    name: 'USDC/USDT',
    baseAsset: {
      isNative: false,
      code: 'USDC',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    },
    counterAsset: {
      isNative: false,
      code: 'USDT',
      issuer: 'GCQTGZQQ5G4PTM2GLINCLQXZMG6MULN9773CZYQZCBQK2YTQMZYLPQWD'
    }
  }
];

async function testDiscovery() {
  console.log('🔍 Testing Discovery Endpoint...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  for (const pair of TEST_PAIRS) {
    console.log(`📊 Testing discovery for ${pair.name}...`);
    
    try {
      const response = await axios.post(`${BASE_URL}/discover`, {
        baseAsset: pair.baseAsset,
        counterAsset: pair.counterAsset
      });
      
      console.log(`✅ Success: ${response.data.success}`);
      console.log(`  Message: ${response.data.message}`);
      console.log(`  Popularity Score: ${response.data.popularityScore}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Failed: ${error.response?.data?.message || error.message}`);
      if (error.response?.data) {
        console.log(`  Details: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      console.log('');
    }
  }

  // Test getting all pairs
  console.log('📋 Testing GET /pairs endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/pairs`);
    console.log(`✅ Success: ${response.data.success}`);
    console.log(`  Total Pairs: ${response.data.count}`);
    console.log('  Pairs:');
    response.data.pairs.forEach((pair, index) => {
      const baseName = pair.baseAsset.isNative ? 'XLM' : `${pair.baseAsset.code}:${pair.baseAsset.issuer}`;
      const counterName = pair.counterAsset.isNative ? 'XLM' : `${pair.counterAsset.code}:${pair.counterAsset.issuer}`;
      console.log(`    ${index + 1}. ${baseName} / ${counterName} (Score: ${pair.popularityScore})`);
    });
  } catch (error) {
    console.log(`❌ Failed: ${error.response?.data?.message || error.message}`);
  }
}

if (require.main === module) {
  testDiscovery().catch(console.error);
}

module.exports = { testDiscovery }; 