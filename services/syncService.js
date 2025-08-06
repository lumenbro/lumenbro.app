const pool = require('../db');
const axios = require('axios');
const cron = require('node-cron');

// Horizon API configuration
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon.stellar.org';

// Popular asset pairs to sync
const POPULAR_PAIRS = [
  { baseAsset: { isNative: true }, counterAsset: { isNative: false, code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' } }
];

// Resolution intervals to sync (in milliseconds as required by Horizon API)
const RESOLUTIONS = [60000, 300000, 900000, 3600000, 86400000];

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

// Resolution helper
const getResolutionName = (resolutionMs) => {
  const names = {
    60000: '1m',
    300000: '5m', 
    900000: '15m',
    3600000: '1h',
    86400000: '1d'
  };
  return names[resolutionMs] || `${resolutionMs}ms`;
};

// Sync service class
class SyncService {
  constructor() {
    this.horizonClient = axios.create({
      baseURL: HORIZON_URL,
      timeout: 30000
    });
    this.isRunning = false;
  }

  // Start the sync service
  start() {
    console.log('Starting sync service...');
    
    // Sync every 5 minutes for recent data
    cron.schedule('*/5 * * * *', () => {
      this.syncRecentData();
    });

    // Sync every hour for historical data
    cron.schedule('0 * * * *', () => {
      this.syncHistoricalData();
    });

    // Initial sync
    this.syncRecentData();
  }

  // Sync recent data (last 24 hours)
  async syncRecentData() {
    if (this.isRunning) {
      console.log('Sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('Starting recent data sync...');

    try {
      for (const pair of POPULAR_PAIRS) {
        for (const resolution of RESOLUTIONS) {
          await this.syncPairData(pair, resolution, 24);
          // Small delay to avoid overwhelming Horizon API
          await this.delay(1000);
        }
      }
      console.log('Recent data sync completed');
    } catch (error) {
      console.error('Recent data sync error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Sync historical data (last 7 days)
  async syncHistoricalData() {
    if (this.isRunning) {
      console.log('Historical sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('Starting historical data sync...');

    try {
      for (const pair of POPULAR_PAIRS) {
        for (const resolution of RESOLUTIONS) {
          await this.syncPairData(pair, resolution, 168); // 7 days
          await this.delay(2000); // Longer delay for historical data
        }
      }
      console.log('Historical data sync completed');
    } catch (error) {
      console.error('Historical data sync error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Sync data for a specific pair and resolution
  async syncPairData(pair, resolution, hours) {
    try {
      const baseAssetStr = formatAsset(pair.baseAsset);
      const counterAssetStr = formatAsset(pair.counterAsset);
      
      console.log(`Syncing ${baseAssetStr}/${counterAssetStr} ${getResolutionName(resolution)} data...`);

      // Get data from Horizon API
      const horizonData = await this.getHorizonData(pair, resolution, hours);
      
      if (!horizonData || horizonData.length === 0) {
        console.log(`No data found for ${baseAssetStr}/${counterAssetStr} ${getResolutionName(resolution)}`);
        return;
      }

      // Store data in database
      let storedCount = 0;
      for (const record of horizonData) {
        const success = await this.storeRecord(record, baseAssetStr, counterAssetStr, resolution);
        if (success) storedCount++;
      }

      console.log(`Stored ${storedCount}/${horizonData.length} records for ${baseAssetStr}/${counterAssetStr} ${getResolutionName(resolution)}`);

      // Update sync status
      await this.updateSyncStatus(baseAssetStr, counterAssetStr, resolution);

    } catch (error) {
      console.error(`Error syncing ${formatAsset(pair.baseAsset)}/${formatAsset(pair.counterAsset)} ${getResolutionName(resolution)}:`, error);
    }
  }

  // Get data from Horizon API
  async getHorizonData(pair, resolution, hours) {
    try {
      const url = `/trade_aggregations`;
      const params = {
        base_asset_type: pair.baseAsset.isNative ? 'native' : 'credit_alphanum4',
        counter_asset_type: pair.counterAsset.isNative ? 'native' : 'credit_alphanum4',
        resolution: resolution,
        limit: Math.min(hours * 60, 200)
      };

      // Add asset-specific parameters only if not native
      if (!pair.baseAsset.isNative) {
        params.base_asset_code = pair.baseAsset.code;
        params.base_asset_issuer = pair.baseAsset.issuer;
      }
      
      if (!pair.counterAsset.isNative) {
        params.counter_asset_code = pair.counterAsset.code;
        params.counter_asset_issuer = pair.counterAsset.issuer;
      }

      const response = await this.horizonClient.get(url, { params });
      
      if (response.data && response.data._embedded && response.data._embedded.records) {
        return response.data._embedded.records;
      }
      
      return [];
    } catch (error) {
      console.error('Horizon API error:', error.message);
      if (error.response && error.response.data) {
        console.error('Horizon error details:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // Store a single record in the database
  async storeRecord(record, baseAsset, counterAsset, resolution) {
    try {
      // Parse timestamp from Horizon API format
      let timestamp;
      if (record.timestamp) {
        // Handle different timestamp formats from Horizon
        if (typeof record.timestamp === 'string') {
          // Convert string timestamp to number first, then create Date
          const timestampNum = parseInt(record.timestamp, 10);
          timestamp = new Date(timestampNum);
        } else if (typeof record.timestamp === 'number') {
          // Horizon sends timestamps in milliseconds, so use directly
          timestamp = new Date(record.timestamp);
        } else {
          timestamp = new Date();
        }
      } else {
        timestamp = new Date();
      }

      // Debug: Log the timestamp processing (without toISOString to avoid RangeError)
      console.log(`Processing timestamp: ${record.timestamp} (type: ${typeof record.timestamp})`);
      console.log(`Created Date object: ${timestamp.getTime()}`);
      console.log(`Is valid: ${!isNaN(timestamp.getTime())}`);

      // Validate timestamp (only check if it's a valid date, not NaN)
      if (isNaN(timestamp.getTime())) {
        console.error('Invalid timestamp from Horizon API:', record.timestamp);
        return false;
      }

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
        timestamp,
        baseAsset,
        counterAsset,
        resolution,
        parseFloat(record.open),
        parseFloat(record.high),
        parseFloat(record.low),
        parseFloat(record.close),
        parseFloat(record.base_volume),
        parseFloat(record.counter_volume),
        parseInt(record.trade_count)
      ]);

      return true;
    } catch (error) {
      console.error('Database insert error:', error);
      return false;
    }
  }

  // Update sync status
  async updateSyncStatus(baseAsset, counterAsset, resolution) {
    try {
      const assetPair = `${baseAsset}/${counterAsset}`;
      const query = `
        INSERT INTO sync_status (asset_pair, resolution, last_synced)
        VALUES ($1, $2, NOW())
        ON CONFLICT (asset_pair, resolution)
        DO UPDATE SET 
          last_synced = NOW(),
          updated_at = NOW()
      `;

      await pool.query(query, [assetPair, resolution]);
    } catch (error) {
      console.error('Update sync status error:', error);
    }
  }

  // Get sync status for all pairs
  async getSyncStatus() {
    try {
      const query = `
        SELECT asset_pair, resolution, last_synced, updated_at
        FROM sync_status
        ORDER BY last_synced DESC
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Get sync status error:', error);
      return [];
    }
  }

  // Manual sync for specific pair
  async manualSync(baseAsset, counterAsset, resolution, hours = 24) {
    const pair = {
      baseAsset: parseAsset(baseAsset),
      counterAsset: parseAsset(counterAsset)
    };
    
    await this.syncPairData(pair, resolution, hours);
  }

  // Utility function for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SyncService(); 