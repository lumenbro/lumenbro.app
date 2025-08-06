require('dotenv').config();
const axios = require('axios');

// Known verified assets from Stellar network
const VERIFIED_ASSETS = {
  // Native assets
  'XLM': { isNative: true },
  
  // Credit assets with verified issuers
  'USDC': {
    isNative: false,
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
  },
  'USDT': {
    isNative: false,
    code: 'USDT',
    issuer: 'GCQTGZQQ5G4PTM2GLINCLQXZMG6MULN9773CZYQZCBQK2YTQMZYLPQWD'
  },
  'BTC': {
    isNative: false,
    code: 'BTC',
    issuer: 'GATEMHCCM7ZABHDBTHWXUZCSZIVJFJD5HYH5GKXELD2XJJGHBR6LETT3'
  },
  'ETH': {
    isNative: false,
    code: 'ETH',
    issuer: 'GBVOL67TMUQBX4CSVHENGK3QZGCMQ5LKDWZKPJJH4X36BZBF2V6KLTGF'
  },
  'EUR': {
    isNative: false,
    code: 'EUR',
    issuer: 'GAP5LETGZ7MFCP7FJLTZJY5Z2Z7LEGCXIUQJM6U75P82NLUVSDkJXIB'
  },
  'JPY': {
    isNative: false,
    code: 'JPY',
    issuer: 'GBVOL67TMUQBX4CSVHENGK3QZGCMQ5LKDWZKPJJH4X36BZBF2V6KLTGF'
  }
};

const HORIZON_BASE_URL = 'https://horizon.stellar.org';

async function validateAsset(assetCode, issuer = null) {
  console.log(`🔍 Validating ${assetCode}${issuer ? ` (${issuer})` : ''}...`);
  
  try {
    if (assetCode === 'XLM') {
      // Test native asset
      const response = await axios.get(`${HORIZON_BASE_URL}/assets?asset_code=${assetCode}&asset_issuer=`);
      return {
        valid: response.data._embedded.records.length > 0,
        records: response.data._embedded.records
      };
    } else {
      // Test credit asset
      const response = await axios.get(`${HORIZON_BASE_URL}/assets?asset_code=${assetCode}&asset_issuer=${issuer}`);
      return {
        valid: response.data._embedded.records.length > 0,
        records: response.data._embedded.records
      };
    }
  } catch (error) {
    console.error(`❌ Error validating ${assetCode}:`, error.message);
    return { valid: false, error: error.message };
  }
}

async function testHorizonTradeAggregations(baseAsset, counterAsset, resolution = '60000') {
  console.log(`📊 Testing Horizon trade aggregations for ${baseAsset.code || 'XLM'}/${counterAsset.code || 'XLM'}...`);
  
  try {
    const params = new URLSearchParams({
      base_asset_type: baseAsset.isNative ? 'native' : 'credit_alphanum4',
      counter_asset_type: counterAsset.isNative ? 'native' : 'credit_alphanum4',
      resolution: resolution,
      limit: '10'
    });

    // Add asset parameters if not native
    if (!baseAsset.isNative) {
      params.append('base_asset_code', baseAsset.code);
      params.append('base_asset_issuer', baseAsset.issuer);
    }
    if (!counterAsset.isNative) {
      params.append('counter_asset_code', counterAsset.code);
      params.append('counter_asset_issuer', counterAsset.issuer);
    }

    const response = await axios.get(`${HORIZON_BASE_URL}/trade_aggregations?${params}`);
    
    return {
      success: true,
      count: response.data._embedded.records.length,
      records: response.data._embedded.records.slice(0, 3), // Show first 3 records
      url: `${HORIZON_BASE_URL}/trade_aggregations?${params}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function validateAllAssets() {
  console.log('🔍 Validating All Assets...\n');

  for (const [code, asset] of Object.entries(VERIFIED_ASSETS)) {
    const result = await validateAsset(code, asset.issuer);
    console.log(`${code}: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
    if (!result.valid) {
      console.log(`  Error: ${result.error}`);
    }
  }
  console.log('');
}

async function testPopularPairs() {
  console.log('📊 Testing Popular Pairs with Horizon...\n');

  const testPairs = [
    { base: VERIFIED_ASSETS.XLM, counter: VERIFIED_ASSETS.USDC },
    { base: VERIFIED_ASSETS.XLM, counter: VERIFIED_ASSETS.USDT },
    { base: VERIFIED_ASSETS.XLM, counter: VERIFIED_ASSETS.BTC },
    { base: VERIFIED_ASSETS.XLM, counter: VERIFIED_ASSETS.ETH },
    { base: VERIFIED_ASSETS.USDC, counter: VERIFIED_ASSETS.USDT },
    { base: VERIFIED_ASSETS.BTC, counter: VERIFIED_ASSETS.USDC },
    { base: VERIFIED_ASSETS.ETH, counter: VERIFIED_ASSETS.USDC }
  ];

  for (const pair of testPairs) {
    const result = await testHorizonTradeAggregations(pair.base, pair.counter);
    const baseName = pair.base.isNative ? 'XLM' : pair.base.code;
    const counterName = pair.counter.isNative ? 'XLM' : pair.counter.code;
    
    console.log(`${baseName}/${counterName}: ${result.success ? '✅ Success' : '❌ Failed'}`);
    if (result.success) {
      console.log(`  Records: ${result.count}`);
      if (result.records.length > 0) {
        console.log(`  Latest: ${result.records[0].timestamp}`);
      }
    } else {
      console.log(`  Error: ${JSON.stringify(result.error, null, 2)}`);
    }
  }
  console.log('');
}

async function testResolutions() {
  console.log('⏰ Testing Different Resolutions...\n');

  const resolutions = [
    { name: '1m', value: '60000' },
    { name: '5m', value: '300000' },
    { name: '15m', value: '900000' },
    { name: '1h', value: '3600000' },
    { name: '1d', value: '86400000' }
  ];

  for (const resolution of resolutions) {
    const result = await testHorizonTradeAggregations(VERIFIED_ASSETS.XLM, VERIFIED_ASSETS.USDC, resolution.value);
    console.log(`${resolution.name} (${resolution.value}ms): ${result.success ? '✅' : '❌'}`);
    if (!result.success) {
      console.log(`  Error: ${result.error?.invalid_field || result.error}`);
    }
  }
  console.log('');
}

async function main() {
  console.log('🧪 Asset Validation and Horizon API Testing\n');
  console.log('=' .repeat(50));

  await validateAllAssets();
  await testPopularPairs();
  await testResolutions();

  console.log('✅ Validation complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateAsset, testHorizonTradeAggregations, VERIFIED_ASSETS }; 