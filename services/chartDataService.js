const pool = require('../db');
const { client: redisClient, CACHE_TTL, cacheKeys } = require('../config/redis');
const axios = require('axios');
const crypto = require('crypto');

// Horizon API configuration
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon.stellar.org';

// Resolution mapping to Horizon intervals
const RESOLUTION_MAP = {
  '1m': '1m',
  '5m': '5m', 
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d'
};

// Asset format helpers
const formatAsset = (asset) => {
  if (asset.isNative) {
    return 'XLM';
  }
  return `${asset.code}:${asset.issuer}`;
};

const parseAsset = (assetString) => {
  if (assetString === 'XLM') {
    return { isNative: true };
  }
  const [code, issuer] = assetString.split(':');
  return { isNative: false, code, issuer };
};

// Chart data point interface
class ChartDataPoint {
  constructor(time, open, high, low, close, volume) {
    this.time = time;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
  }
}

// Chart data service
class ChartDataService {
  constructor() {
    this.horizonClient = axios.create({
      baseURL: HORIZON_URL,
      timeout: 10000
    });
  }

  // Get single chart data from database or Horizon API
  async getChartData(baseAsset, counterAsset, resolution, hours = 24) {
    const cacheKey = cacheKeys.chartData(formatAsset(baseAsset), formatAsset(counterAsset), resolution, hours);
    
    // Try cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }

    // Query database
    const dbData = await this.getChartDataFromDB(baseAsset, counterAsset, resolution, hours);
    
    if (dbData && dbData.length > 0) {
      // Cache the result
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL.WARM_DATA, JSON.stringify(dbData));
      } catch (error) {
        console.error('Redis set error:', error);
      }
      return dbData;
    }

    // Fallback to Horizon API
    const horizonData = await this.getChartDataFromHorizon(baseAsset, counterAsset, resolution, hours);
    
    if (horizonData && horizonData.length > 0) {
      // Cache the result
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL.HOT_DATA, JSON.stringify(horizonData));
      } catch (error) {
        console.error('Redis set error:', error);
      }
      return horizonData;
    }

    return [];
  }

  // Get chart data from TimescaleDB
  async getChartDataFromDB(baseAsset, counterAsset, resolution, hours) {
    try {
      const baseAssetStr = formatAsset(baseAsset);
      const counterAssetStr = formatAsset(counterAsset);
      const resolutionInterval = RESOLUTION_MAP[resolution];
      
      const query = `
        SELECT 
          EXTRACT(EPOCH FROM timestamp) * 1000 as time,
          open,
          high,
          low,
          close,
          base_volume as volume
        FROM trade_aggregations 
        WHERE base_asset = $1 
          AND counter_asset = $2 
          AND resolution = $3::interval
          AND timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp ASC
      `;

      const result = await pool.query(query, [baseAssetStr, counterAssetStr, resolutionInterval]);
      return result.rows;
    } catch (error) {
      console.error('Database query error:', error);
      return null;
    }
  }

  // Get chart data from Horizon API
  async getChartDataFromHorizon(baseAsset, counterAsset, resolution, hours) {
    try {
      const baseAssetStr = formatAsset(baseAsset);
      const counterAssetStr = formatAsset(counterAsset);
      const resolutionInterval = RESOLUTION_MAP[resolution];
      
      const url = `/trade_aggregations`;
      const params = {
        base_asset_type: baseAsset.isNative ? 'native' : 'credit_alphanum4',
        counter_asset_type: counterAsset.isNative ? 'native' : 'credit_alphanum4',
        base_asset_code: baseAsset.isNative ? undefined : baseAsset.code,
        base_asset_issuer: baseAsset.isNative ? undefined : baseAsset.issuer,
        counter_asset_code: counterAsset.isNative ? undefined : counterAsset.code,
        counter_asset_issuer: counterAsset.isNative ? undefined : counterAsset.issuer,
        resolution: resolutionInterval,
        limit: Math.min(hours * 60, 200) // Limit to prevent overwhelming API
      };

      const response = await this.horizonClient.get(url, { params });
      
      if (response.data && response.data._embedded && response.data._embedded.records) {
        return response.data._embedded.records.map(record => ({
          time: new Date(record.timestamp).getTime(),
          open: parseFloat(record.open),
          high: parseFloat(record.high),
          low: parseFloat(record.low),
          close: parseFloat(record.close),
          volume: parseFloat(record.base_volume)
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Horizon API error:', error);
      return null;
    }
  }

  // Get batch chart data for multiple pairs
  async getBatchChartData(pairs) {
    const pairsHash = crypto.createHash('md5').update(JSON.stringify(pairs)).digest('hex');
    const cacheKey = cacheKeys.batchChartData(pairsHash);
    
    // Try cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }

    // Process all pairs
    const results = await Promise.all(
      pairs.map(async (pair) => {
        try {
          const data = await this.getChartData(
            pair.baseAsset,
            pair.counterAsset,
            pair.resolution,
            pair.hours || 24
          );
          
          return {
            pair: {
              baseAsset: pair.baseAsset,
              counterAsset: pair.counterAsset,
              resolution: pair.resolution
            },
            data
          };
        } catch (error) {
          console.error(`Error fetching data for pair:`, pair, error);
          return {
            pair: {
              baseAsset: pair.baseAsset,
              counterAsset: pair.counterAsset,
              resolution: pair.resolution
            },
            data: [],
            error: error.message
          };
        }
      })
    );

    // Cache the batch result
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL.WARM_DATA, JSON.stringify(results));
    } catch (error) {
      console.error('Redis set error:', error);
    }

    return results;
  }

  // Store aggregated data in database
  async storeAggregatedData(data) {
    try {
      const query = `
        INSERT INTO trade_aggregations (
          timestamp, base_asset, counter_asset, resolution,
          open, high, low, close, base_volume, counter_volume, trade_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (timestamp, base_asset, counter_asset, resolution) 
        DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          base_volume = EXCLUDED.base_volume,
          counter_volume = EXCLUDED.counter_volume,
          trade_count = EXCLUDED.trade_count
      `;

      await pool.query(query, [
        data.timestamp,
        data.base_asset,
        data.counter_asset,
        data.resolution,
        data.open,
        data.high,
        data.low,
        data.close,
        data.base_volume,
        data.counter_volume,
        data.trade_count
      ]);

      return true;
    } catch (error) {
      console.error('Database insert error:', error);
      return false;
    }
  }

  // Update popular pairs tracking
  async updatePopularPairs(baseAsset, counterAsset) {
    try {
      const query = `
        INSERT INTO popular_pairs (base_asset, counter_asset, popularity_score)
        VALUES ($1, $2, 1)
        ON CONFLICT (base_asset, counter_asset)
        DO UPDATE SET 
          popularity_score = popular_pairs.popularity_score + 1,
          last_accessed = NOW()
      `;

      await pool.query(query, [formatAsset(baseAsset), formatAsset(counterAsset)]);
    } catch (error) {
      console.error('Update popular pairs error:', error);
    }
  }

  // Get popular pairs
  async getPopularPairs(limit = 10) {
    try {
      const query = `
        SELECT base_asset, counter_asset, popularity_score
        FROM popular_pairs
        ORDER BY popularity_score DESC, last_accessed DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      return result.rows.map(row => ({
        baseAsset: parseAsset(row.base_asset),
        counterAsset: parseAsset(row.counter_asset),
        popularityScore: row.popularity_score
      }));
    } catch (error) {
      console.error('Get popular pairs error:', error);
      return [];
    }
  }
}

module.exports = new ChartDataService(); 