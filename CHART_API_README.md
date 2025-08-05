# Stellar Chart Data API

A centralized chart data API server for Stellar DEX trading applications, designed to replace client-side chart fetching and improve performance.

## Features

- **High Performance**: Redis caching with multiple TTL tiers
- **Batch Processing**: Fetch multiple chart pairs in a single request
- **Real-time Updates**: WebSocket support for live chart data
- **Time-series Database**: TimescaleDB for efficient historical data storage
- **Background Sync**: Automated data aggregation from Stellar Horizon API
- **Popular Pairs Tracking**: Optimized caching for frequently accessed pairs

## Architecture

### Data Flow
1. **Primary**: TimescaleDB (pre-aggregated data)
2. **Fallback**: Stellar Horizon API (current implementation)
3. **Cache**: Redis (hot data, popular pairs)

### Components
- **Chart Data Service**: Core data aggregation and caching logic
- **Sync Service**: Background data synchronization from Horizon API
- **WebSocket Service**: Real-time updates for connected clients
- **API Routes**: RESTful endpoints for chart data access

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL with TimescaleDB extension
- Redis server
- PM2 (for production)

### Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Database Setup**
```bash
# Run migrations
npm run migrate
```

3. **Environment Configuration**
```bash
# Add to your .env file
DATABASE_URL=postgresql://user:pass@localhost:5432/stellar_charts
REDIS_URL=redis://localhost:6379
HORIZON_URL=https://horizon.stellar.org
NODE_ENV=production
```

4. **Start Services**
```bash
# Development
npm run dev

# Production
pm2 start ecosystem.config.js
```

## API Endpoints

### Single Chart Data
```http
GET /api/charts/single?baseAsset={asset}&counterAsset={asset}&resolution={resolution}&hours={hours}
```

**Parameters:**
- `baseAsset`: JSON string of asset object `{"isNative": true}` or `{"isNative": false, "code": "USDC", "issuer": "..."}`
- `counterAsset`: JSON string of asset object
- `resolution`: One of `1m`, `5m`, `15m`, `1h`, `4h`, `1d`
- `hours`: Number of hours to fetch (1-168, default: 24)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "time": 1640995200000,
      "open": 0.1234,
      "high": 0.1250,
      "low": 0.1220,
      "close": 0.1245,
      "volume": 1000000.0
    }
  ],
  "pair": {
    "baseAsset": {"isNative": true},
    "counterAsset": {"isNative": false, "code": "USDC", "issuer": "..."},
    "resolution": "1h"
  },
  "hours": 24
}
```

### Batch Chart Data
```http
POST /api/charts/batch
Content-Type: application/json

{
  "pairs": [
    {
      "baseAsset": {"isNative": true},
      "counterAsset": {"isNative": false, "code": "USDC", "issuer": "..."},
      "resolution": "1h",
      "hours": 24
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "pair": {
        "baseAsset": {"isNative": true},
        "counterAsset": {"isNative": false, "code": "USDC", "issuer": "..."},
        "resolution": "1h"
      },
      "data": [...]
    }
  ],
  "count": 1
}
```

### Popular Pairs
```http
GET /api/charts/popular?limit=10
```

### Sync Status
```http
GET /api/charts/sync-status
```

### Health Check
```http
GET /api/charts/health
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Subscribe to Chart Updates
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  pair: {
    baseAsset: { isNative: true },
    counterAsset: { isNative: false, code: 'USDC', issuer: '...' }
  },
  resolution: '1h'
}));
```

### Unsubscribe
```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  pair: {
    baseAsset: { isNative: true },
    counterAsset: { isNative: false, code: 'USDC', issuer: '...' }
  },
  resolution: '1h'
}));
```

### Message Types
- `connected`: Initial connection confirmation
- `subscribed`: Subscription confirmation
- `unsubscribed`: Unsubscription confirmation
- `chart_update`: Real-time chart data update
- `error`: Error message
- `pong`: Response to ping

## Database Schema

### TimescaleDB Hypertable
```sql
CREATE TABLE trade_aggregations (
    timestamp TIMESTAMPTZ NOT NULL,
    base_asset TEXT NOT NULL,
    counter_asset TEXT NOT NULL,
    resolution INTERVAL NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    base_volume DECIMAL(20,8) NOT NULL,
    counter_volume DECIMAL(20,8) NOT NULL,
    trade_count INTEGER NOT NULL
);
```

### Sync Status Table
```sql
CREATE TABLE sync_status (
    id SERIAL PRIMARY KEY,
    asset_pair TEXT NOT NULL,
    resolution INTERVAL NOT NULL,
    last_synced TIMESTAMPTZ,
    last_cursor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_pair, resolution)
);
```

### Popular Pairs Table
```sql
CREATE TABLE popular_pairs (
    id SERIAL PRIMARY KEY,
    base_asset TEXT NOT NULL,
    counter_asset TEXT NOT NULL,
    popularity_score INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(base_asset, counter_asset)
);
```

## Caching Strategy

### Redis Cache TTL
- **Hot Data**: 60 seconds (very recent data)
- **Warm Data**: 300 seconds (recent data)
- **Cold Data**: 3600 seconds (older data)

### Cache Keys
- `chart:{baseAsset}:{counterAsset}:{resolution}:{hours}`
- `batch:{pairsHash}`
- `popular:pairs`
- `sync:{assetPair}:{resolution}`

## Background Sync

### Automated Sync Schedule
- **Recent Data**: Every 5 minutes (last 24 hours)
- **Historical Data**: Every hour (last 7 days)

### Popular Pairs Synced
- XLM/USDC
- XLM/USDT
- XLM/BTC
- XLM/ETH

### Resolutions Synced
- 1m, 5m, 15m, 1h, 4h, 1d

## Performance Targets

- **Response Time**: <100ms for cached data
- **Batch Processing**: <500ms for 10 pairs
- **Cache Hit Rate**: >90% for popular pairs
- **WebSocket Latency**: <50ms for real-time updates

## Monitoring

### Health Check
```http
GET /api/charts/health
```

### WebSocket Stats
```http
GET /api/websocket/stats
```

### API Status
```http
GET /api/status
```

## Development

### Local Development
```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### Docker Development
```bash
# Start TimescaleDB
docker run -d --name timescaledb -p 5432:5432 timescale/timescaledb:latest-pg14

# Start Redis
docker run -d --name redis -p 6379:6379 redis:alpine

# Set environment variables
export DATABASE_URL=postgresql://user:pass@localhost:5432/stellar_charts
export REDIS_URL=redis://localhost:6379
```

## Production Deployment

### EC2 Setup
1. Install Node.js 18+
2. Install PostgreSQL with TimescaleDB
3. Install Redis
4. Configure PM2
5. Set up Nginx reverse proxy
6. Configure SSL with Let's Encrypt

### Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/stellar_charts
REDIS_URL=redis://localhost:6379
HORIZON_URL=https://horizon.stellar.org
```

### PM2 Configuration
```javascript
module.exports = {
  apps: [{
    name: "lumenbro-charts",
    script: "app.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: "production"
    }
  }]
};
```

## Migration from Client-Side

### Update React Query Hook
```typescript
// Before: Direct Horizon API calls
const { data } = useQuery({
  queryKey: ['horizon', pair, resolution],
  queryFn: () => fetchHorizonData(pair, resolution)
});

// After: Use new batch API
const { data } = useQuery({
  queryKey: ['batchCharts', pairs],
  queryFn: () => fetchBatchChartData(pairs)
});
```

### WebSocket Integration
```typescript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'chart_update') {
    // Update chart with real-time data
    updateChart(message.data);
  }
};
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL service status
   - Verify connection string in .env
   - Ensure TimescaleDB extension is installed

2. **Redis Connection Failed**
   - Check Redis service status
   - Verify Redis URL in .env
   - Check Redis memory usage

3. **Sync Service Not Running**
   - Check NODE_ENV is set to 'production'
   - Verify cron jobs are scheduled
   - Check logs for sync errors

4. **WebSocket Connection Failed**
   - Verify WebSocket service is initialized
   - Check firewall settings
   - Ensure proper WebSocket URL

### Logs
```bash
# PM2 logs
pm2 logs lumenbro-charts

# Application logs
tail -f /var/log/lumenbro/app.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 