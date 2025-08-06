const express = require('express');
const router = express.Router();
const chartDataService = require('../services/chartDataService');
const syncService = require('../services/syncService');

// Validation helpers
const validateAsset = (asset) => {
  if (!asset) return false;
  if (asset.isNative) return true;
  return asset.code && asset.issuer;
};

const validateResolution = (resolution) => {
  const validResolutions = ['1m', '5m', '15m', '1h', '4h', '1d'];
  return validResolutions.includes(resolution);
};

// Asset formatting helpers
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

// Single chart data endpoint
router.get('/single', async (req, res) => {
  try {
    const { baseAsset, counterAsset, resolution, hours } = req.query;

    // Validate parameters
    if (!baseAsset || !counterAsset || !resolution) {
      return res.status(400).json({
        error: 'Missing required parameters: baseAsset, counterAsset, resolution'
      });
    }

    // Parse assets
    let parsedBaseAsset, parsedCounterAsset;
    try {
      parsedBaseAsset = JSON.parse(baseAsset);
      parsedCounterAsset = JSON.parse(counterAsset);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid asset format. Expected JSON string.'
      });
    }

    // Validate assets
    if (!validateAsset(parsedBaseAsset) || !validateAsset(parsedCounterAsset)) {
      return res.status(400).json({
        error: 'Invalid asset format'
      });
    }

    // Validate resolution
    if (!validateResolution(resolution)) {
      return res.status(400).json({
        error: 'Invalid resolution. Must be one of: 1m, 5m, 15m, 1h, 4h, 1d'
      });
    }

    // Validate hours
    const hoursNum = parseInt(hours) || 24;
    if (hoursNum < 1 || hoursNum > 168) {
      return res.status(400).json({
        error: 'Hours must be between 1 and 168'
      });
    }

    // Update popular pairs tracking
    await chartDataService.updatePopularPairs(parsedBaseAsset, parsedCounterAsset);

    // Get chart data
    const data = await chartDataService.getChartData(
      parsedBaseAsset,
      parsedCounterAsset,
      resolution,
      hoursNum
    );

    res.json({
      success: true,
      data,
      pair: {
        baseAsset: parsedBaseAsset,
        counterAsset: parsedCounterAsset,
        resolution
      },
      hours: hoursNum
    });

  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Batch chart data endpoint
router.post('/batch', async (req, res) => {
  try {
    const { pairs } = req.body;

    // Validate request body
    if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid pairs array'
      });
    }

    if (pairs.length > 20) {
      return res.status(400).json({
        error: 'Too many pairs. Maximum 20 pairs allowed.'
      });
    }

    // Validate each pair
    const validatedPairs = [];
    for (const pair of pairs) {
      if (!pair.baseAsset || !pair.counterAsset || !pair.resolution) {
        return res.status(400).json({
          error: 'Each pair must have baseAsset, counterAsset, and resolution'
        });
      }

      if (!validateAsset(pair.baseAsset) || !validateAsset(pair.counterAsset)) {
        return res.status(400).json({
          error: 'Invalid asset format in pair'
        });
      }

      if (!validateResolution(pair.resolution)) {
        return res.status(400).json({
          error: 'Invalid resolution in pair'
        });
      }

      // Validate hours
      const hours = pair.hours || 24;
      if (hours < 1 || hours > 168) {
        return res.status(400).json({
          error: 'Hours must be between 1 and 168'
        });
      }

      validatedPairs.push({
        baseAsset: pair.baseAsset,
        counterAsset: pair.counterAsset,
        resolution: pair.resolution,
        hours: hours
      });

      // Update popular pairs tracking
      await chartDataService.updatePopularPairs(pair.baseAsset, pair.counterAsset);
    }

    // Get batch chart data
    const results = await chartDataService.getBatchChartData(validatedPairs);

    res.json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Batch chart data error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Popular pairs endpoint
router.get('/popular', async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = parseInt(limit) || 10;

    if (limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 50'
      });
    }

    const popularPairs = await chartDataService.getPopularPairs(limitNum);

    res.json({
      success: true,
      pairs: popularPairs,
      count: popularPairs.length
    });

  } catch (error) {
    console.error('Popular pairs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Sync status endpoint
router.get('/sync-status', async (req, res) => {
  try {
    const syncStatus = await syncService.getSyncStatus();

    res.json({
      success: true,
      syncStatus,
      count: syncStatus.length
    });

  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Manual sync endpoint (admin only)
router.post('/sync', async (req, res) => {
  try {
    const { baseAsset, counterAsset, resolution, hours } = req.body;

    // Validate parameters
    if (!baseAsset || !counterAsset || !resolution) {
      return res.status(400).json({
        error: 'Missing required parameters: baseAsset, counterAsset, resolution'
      });
    }

    // Validate resolution
    if (!validateResolution(resolution)) {
      return res.status(400).json({
        error: 'Invalid resolution. Must be one of: 1m, 5m, 15m, 1h, 4h, 1d'
      });
    }

    // Validate hours
    const hoursNum = parseInt(hours) || 24;
    if (hoursNum < 1 || hoursNum > 168) {
      return res.status(400).json({
        error: 'Hours must be between 1 and 168'
      });
    }

    // Start manual sync
    await syncService.manualSync(baseAsset, counterAsset, resolution, hoursNum);

    res.json({
      success: true,
      message: 'Manual sync started',
      params: { baseAsset, counterAsset, resolution, hours: hoursNum }
    });

  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Discover new pairs endpoint
router.post('/discover', async (req, res) => {
  try {
    const { baseAsset, counterAsset } = req.body;

    // Validate assets
    if (!validateAsset(baseAsset) || !validateAsset(counterAsset)) {
      return res.status(400).json({
        error: 'Invalid asset format'
      });
    }

    // Check if pair exists in database
    const pool = require('../db');
    const result = await pool.query(
      'SELECT * FROM popular_pairs WHERE base_asset = $1 AND counter_asset = $2',
      [formatAsset(baseAsset), formatAsset(counterAsset)]
    );

    if (result.rows.length === 0) {
      // Add new pair to database
      await pool.query(
        'INSERT INTO popular_pairs (base_asset, counter_asset, popularity_score) VALUES ($1, $2, $3)',
        [formatAsset(baseAsset), formatAsset(counterAsset), 1]
      );
    } else {
      // Update popularity score
      await pool.query(
        'UPDATE popular_pairs SET popularity_score = popularity_score + 1, last_accessed = NOW() WHERE base_asset = $1 AND counter_asset = $2',
        [formatAsset(baseAsset), formatAsset(counterAsset)]
      );
    }

    // Get the updated popularity score
    const updatedResult = await pool.query(
      'SELECT popularity_score FROM popular_pairs WHERE base_asset = $1 AND counter_asset = $2',
      [formatAsset(baseAsset), formatAsset(counterAsset)]
    );

    res.json({
      success: true,
      message: 'Pair discovered and added to tracking',
      pair: { baseAsset, counterAsset },
      popularityScore: updatedResult.rows[0]?.popularity_score || 1
    });

  } catch (error) {
    console.error('Discover pair error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get all tracked pairs (including discovered ones)
router.get('/pairs', async (req, res) => {
  try {
    const pool = require('../db');
    const result = await pool.query(
      'SELECT base_asset, counter_asset, popularity_score, last_accessed FROM popular_pairs ORDER BY popularity_score DESC'
    );

    const pairs = result.rows.map(row => {
      const baseAsset = parseAsset(row.base_asset);
      const counterAsset = parseAsset(row.counter_asset);
      return {
        baseAsset,
        counterAsset,
        popularityScore: row.popularity_score,
        lastAccessed: row.last_accessed
      };
    });

    res.json({
      success: true,
      pairs,
      count: pairs.length
    });

  } catch (error) {
    console.error('Get pairs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const pool = require('../db');
    await pool.query('SELECT 1');

    // Test Redis connection
    const { client: redisClient } = require('../config/redis');
    await redisClient.ping();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 