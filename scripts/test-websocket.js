const WebSocket = require('ws');

console.log('🧪 Testing WebSocket Streaming...');

const ws = new WebSocket('wss://lumenbro.com/api/charts/stream');

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  
  // Subscribe to XLM/USDC 1h updates (correct format)
  const subscribeMessage = {
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
  };
  
  ws.send(JSON.stringify(subscribeMessage));
  console.log('📡 Sent subscription message');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('📊 Received:', message);
  } catch (error) {
    console.log('📄 Raw message:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
});

// Keep connection alive for 30 seconds
setTimeout(() => {
  console.log('⏰ Test complete, closing connection...');
  ws.close();
}, 30000); 