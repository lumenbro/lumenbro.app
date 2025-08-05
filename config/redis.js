const redis = require('redis');

// Create Redis client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with a individual error
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands with a individual error
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Connect to Redis
client.connect().catch(console.error);

// Handle connection events
client.on('connect', () => {
  console.log('Redis client connected');
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.on('ready', () => {
  console.log('Redis client ready');
});

// Cache configuration
const CACHE_TTL = {
  HOT_DATA: 60, // 1 minute for very recent data
  WARM_DATA: 300, // 5 minutes for recent data
  COLD_DATA: 3600 // 1 hour for older data
};

// Cache key generators
const cacheKeys = {
  chartData: (baseAsset, counterAsset, resolution, hours) => 
    `chart:${baseAsset}:${counterAsset}:${resolution}:${hours}`,
  
  batchChartData: (pairsHash) => 
    `batch:${pairsHash}`,
  
  popularPairs: () => 
    'popular:pairs',
  
  syncStatus: (assetPair, resolution) => 
    `sync:${assetPair}:${resolution}`
};

module.exports = {
  client,
  CACHE_TTL,
  cacheKeys
}; 