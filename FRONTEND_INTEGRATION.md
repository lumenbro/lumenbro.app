# Frontend Integration Guide

## API Base URL
```
https://lumenbro.com/api/charts
```

## Environment Variables for Frontend

```javascript
// Add these to your .env file
REACT_APP_CHART_API_BASE_URL=https://lumenbro.com/api/charts
REACT_APP_WEBSOCKET_URL=wss://lumenbro.com/api/charts/stream
```

## API Endpoints

### 1. Health Check
```javascript
const response = await fetch('https://lumenbro.com/api/charts/health');
const health = await response.json();
// Returns: { success: true, status: "healthy", services: {...} }
```

### 2. Single Chart Data
```javascript
const params = new URLSearchParams({
  baseAsset: JSON.stringify({ isNative: true }),
  counterAsset: JSON.stringify({ 
    isNative: false, 
    code: 'USDC', 
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' 
  }),
  resolution: '1h',
  hours: '24'
});

const response = await fetch(`https://lumenbro.com/api/charts/single?${params}`);
const data = await response.json();
// Returns: { success: true, data: [...], pair: {...}, hours: 24 }
```

### 3. Batch Chart Data
```javascript
const response = await fetch('https://lumenbro.com/api/charts/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pairs: [
      {
        baseAsset: { isNative: true },
        counterAsset: { 
          isNative: false, 
          code: 'USDC', 
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' 
        },
        resolution: '1h',
        hours: 24
      }
    ]
  })
});
const data = await response.json();
// Returns: { success: true, results: [...], count: 1 }
```

### 4. Popular Pairs
```javascript
const response = await fetch('https://lumenbro.com/api/charts/popular');
const data = await response.json();
// Returns: { success: true, pairs: [...], count: 7 }
```

### 5. Sync Status
```javascript
const response = await fetch('https://lumenbro.com/api/charts/sync-status');
const data = await response.json();
// Returns: { success: true, syncStatus: [...], count: 0 }
```

### 6. Discover New Pairs
```javascript
const response = await fetch('https://lumenbro.com/api/charts/discover', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseAsset: { isNative: true },
    counterAsset: { 
      isNative: false, 
      code: 'NEW_TOKEN', 
      issuer: 'GBNEWTOKEN1234567890...' 
    }
  })
});
const data = await response.json();
// Returns: { success: true, message: 'Pair discovered and added to tracking', pair: {...} }
```

### 7. Get All Tracked Pairs
```javascript
const response = await fetch('https://lumenbro.com/api/charts/pairs');
const data = await response.json();
// Returns: { success: true, pairs: [...], count: 10 }
```

## WebSocket Integration

### Connection Setup
```javascript
const ws = new WebSocket('wss://lumenbro.com/api/charts/stream');

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // Subscribe to chart updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    pair: {
      baseAsset: { isNative: true },
      counterAsset: { 
        isNative: false, 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' 
      }
    },
    resolution: '1h'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'connected':
      console.log('Connected to chart stream');
      break;
      
    case 'subscribed':
      console.log('Subscribed to chart updates');
      break;
      
    case 'chart_update':
      // Handle real-time chart data
      console.log('Chart update:', message.data);
      break;
      
    case 'error':
      console.error('WebSocket error:', message.error);
      break;
  }
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## Asset Format Reference

### Native XLM
```javascript
{ isNative: true }
```

### Credit Assets (USDC, USDT, etc.)
```javascript
{
  isNative: false,
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F'
}
```

## Popular Asset Pairs

### Pre-configured Pairs
```javascript
const POPULAR_PAIRS = [
  {
    baseAsset: { isNative: true },
    counterAsset: { 
      isNative: false, 
      code: 'USDC', 
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' 
    }
  },
  {
    baseAsset: { isNative: true },
    counterAsset: { 
      isNative: false, 
      code: 'USDT', 
      issuer: 'GCQTGZQQ5G4PTM2GLRNCDOTK3DJPJ6JKQIMWZXYGEW3C2I44F7XLVTNR' 
    }
  },
  {
    baseAsset: { isNative: true },
    counterAsset: { 
      isNative: false, 
      code: 'BTC', 
      issuer: 'GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYLPFD5V2C3QN5KRSV2ANMKDLO6Q7' 
    }
  },
  {
    baseAsset: { isNative: true },
    counterAsset: { 
      isNative: false, 
      code: 'ETH', 
      issuer: 'GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYLPFD5V2C3QN5KRSV2ANMKDLO6Q7' 
    }
  }
];
```

## Resolution Options

```javascript
const RESOLUTIONS = ['1m', '5m', '15m', '1h', '4h', '1d'];
```

## Error Handling

### Common Error Responses
```javascript
// Invalid asset format
{ error: "Invalid asset format. Expected JSON string." }

// Missing parameters
{ error: "Missing required parameters: baseAsset, counterAsset, resolution" }

// Invalid resolution
{ error: "Invalid resolution. Must be one of: 1m, 5m, 15m, 1h, 4h, 1d" }

// Hours out of range
{ error: "Hours must be between 1 and 168" }
```

## React Hook Example

```javascript
import { useState, useEffect, useRef } from 'react';

export const useChartData = (baseAsset, counterAsset, resolution, hours = 24) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          baseAsset: JSON.stringify(baseAsset),
          counterAsset: JSON.stringify(counterAsset),
          resolution,
          hours: hours.toString()
        });

        const response = await fetch(`https://lumenbro.com/api/charts/single?${params}`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [baseAsset, counterAsset, resolution, hours]);

  useEffect(() => {
    // WebSocket for real-time updates
    wsRef.current = new WebSocket('wss://lumenbro.com/api/charts/stream');

    wsRef.current.onopen = () => {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        pair: { baseAsset, counterAsset },
        resolution
      }));
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'chart_update') {
        setData(prev => [...prev, message.data]);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [baseAsset, counterAsset, resolution]);

  return { data, loading, error };
};
```

## Usage Example

```javascript
import { useChartData } from './hooks/useChartData';

function ChartComponent() {
  const { data, loading, error } = useChartData(
    { isNative: true },
    { 
      isNative: false, 
      code: 'USDC', 
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTG335Z6RGBAOQTUBO3BCRK4TTKZ7F' 
    },
    '1h',
    24
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {data.map((candle, index) => (
        <div key={index}>
          Time: {candle.timestamp}, Close: {candle.close}
        </div>
      ))}
    </div>
  );
}
```

## Testing Checklist

- [ ] Health endpoint responds
- [ ] Single chart data endpoint works
- [ ] Batch chart data endpoint works
- [ ] Popular pairs endpoint works
- [ ] Sync status endpoint works
- [ ] WebSocket connects successfully
- [ ] WebSocket subscription works
- [ ] Real-time updates received
- [ ] Error handling works correctly
- [ ] Asset format validation works

## Performance Notes

- **Caching**: Data is cached in Redis for 1-60 minutes
- **Rate Limiting**: No current limits, but monitor usage
- **WebSocket**: Supports up to 100 concurrent connections
- **Response Time**: <100ms for cached data, <500ms for fresh data 