const WebSocket = require('ws');
const chartDataService = require('./chartDataService');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Map to store client subscriptions
    this.heartbeatInterval = null;
    
    this.init();
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');
      
      // Set up client
      this.setupClient(ws);
      
      // Handle incoming messages
      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  setupClient(ws) {
    ws.isAlive = true;
    ws.subscriptions = new Set();
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now(),
      message: 'Connected to Stellar Chart Data WebSocket'
    }));
  }

  handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(ws, data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(ws, data);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Unknown message type',
            timestamp: Date.now()
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid JSON message',
        timestamp: Date.now()
      }));
    }
  }

  handleSubscribe(ws, data) {
    const { pair, resolution } = data;
    
    if (!pair || !resolution) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Missing pair or resolution',
        timestamp: Date.now()
      }));
      return;
    }

    // Validate pair
    if (!pair.baseAsset || !pair.counterAsset) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid pair format',
        timestamp: Date.now()
      }));
      return;
    }

    // Validate resolution
    const validResolutions = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validResolutions.includes(resolution)) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid resolution',
        timestamp: Date.now()
      }));
      return;
    }

    // Create subscription key
    const subscriptionKey = `${JSON.stringify(pair)}:${resolution}`;
    
    // Add to client subscriptions
    ws.subscriptions.add(subscriptionKey);
    
    // Add to global clients map
    if (!this.clients.has(subscriptionKey)) {
      this.clients.set(subscriptionKey, new Set());
    }
    this.clients.get(subscriptionKey).add(ws);

    // Send confirmation
    ws.send(JSON.stringify({
      type: 'subscribed',
      pair,
      resolution,
      timestamp: Date.now()
    }));

    console.log(`Client subscribed to ${subscriptionKey}`);
  }

  handleUnsubscribe(ws, data) {
    const { pair, resolution } = data;
    
    if (!pair || !resolution) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Missing pair or resolution',
        timestamp: Date.now()
      }));
      return;
    }

    // Create subscription key
    const subscriptionKey = `${JSON.stringify(pair)}:${resolution}`;
    
    // Remove from client subscriptions
    ws.subscriptions.delete(subscriptionKey);
    
    // Remove from global clients map
    if (this.clients.has(subscriptionKey)) {
      this.clients.get(subscriptionKey).delete(ws);
      
      // Clean up empty subscription
      if (this.clients.get(subscriptionKey).size === 0) {
        this.clients.delete(subscriptionKey);
      }
    }

    // Send confirmation
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      pair,
      resolution,
      timestamp: Date.now()
    }));

    console.log(`Client unsubscribed from ${subscriptionKey}`);
  }

  handleDisconnect(ws) {
    console.log('WebSocket client disconnected');
    
    // Remove client from all subscriptions
    for (const subscriptionKey of ws.subscriptions) {
      if (this.clients.has(subscriptionKey)) {
        this.clients.get(subscriptionKey).delete(ws);
        
        // Clean up empty subscription
        if (this.clients.get(subscriptionKey).size === 0) {
          this.clients.delete(subscriptionKey);
        }
      }
    }
  }

  // Broadcast chart data update to subscribed clients
  broadcastChartUpdate(pair, resolution, data) {
    const subscriptionKey = `${JSON.stringify(pair)}:${resolution}`;
    
    if (this.clients.has(subscriptionKey)) {
      const message = JSON.stringify({
        type: 'chart_update',
        pair,
        resolution,
        data,
        timestamp: Date.now()
      });

      const clients = this.clients.get(subscriptionKey);
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          // Remove disconnected client
          clients.delete(client);
        }
      });

      // Clean up empty subscription
      if (clients.size === 0) {
        this.clients.delete(subscriptionKey);
      }
    }
  }

  // Start heartbeat to keep connections alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Get connection stats
  getStats() {
    const totalClients = this.wss.clients.size;
    const totalSubscriptions = this.clients.size;
    
    return {
      totalClients,
      totalSubscriptions,
      subscriptions: Array.from(this.clients.keys())
    };
  }

  // Close all connections
  close() {
    this.stopHeartbeat();
    this.wss.close();
  }
}

module.exports = WebSocketService; 