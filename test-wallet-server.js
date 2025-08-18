const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Test wallet data (simulate your Turnkey setup)
const TEST_ACCOUNT = {
  publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  secretKey: 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // This would be from your KMS
  network: 'testnet'
};

// Mock signing endpoint (simulates your Python bot)
app.post('/api/sign', async (req, res) => {
  try {
    const { xdr, telegram_id } = req.body;
    
    console.log('🔐 Mock signing request:');
    console.log('  Telegram ID:', telegram_id);
    console.log('  XDR:', xdr.substring(0, 50) + '...');
    
    // Simulate signing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock signed XDR
    const mockSignedXdr = xdr + '-SIGNED-BY-MOCK';
    
    res.json({
      success: true,
      signed_xdr: mockSignedXdr,
      hash: `mock-tx-${Date.now()}`,
      fee: 0.00001
    });
  } catch (error) {
    console.error('❌ Signing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mock balance endpoint
app.get('/api/balance/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    console.log('💰 Balance request for:', publicKey);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock balance data
    res.json({
      success: true,
      balance: '100.0000000',
      asset: 'XLM',
      publicKey: publicKey
    });
  } catch (error) {
    console.error('❌ Balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test Python bot API endpoint
app.post('/api/test-python-bot', async (req, res) => {
  try {
    const { telegram_id, test_type } = req.body;
    
    console.log('🧪 Testing Python bot API:');
    console.log('  Telegram ID:', telegram_id);
    console.log('  Test Type:', test_type);
    
    // This will be replaced with actual Python bot call
    const pythonBotUrl = 'http://localhost:8080'; // Your Python bot URL
    
    let testResult;
    
    switch (test_type) {
      case 'connection':
        // Test basic connection
        testResult = {
          success: true,
          message: 'Python bot connection test',
          endpoint: `${pythonBotUrl}/api/health`,
          status: 'mock_response'
        };
        break;
        
      case 'sign':
        // Test signing endpoint
        testResult = {
          success: true,
          message: 'Python bot signing test',
          endpoint: `${pythonBotUrl}/api/sign`,
          mock_xdr: 'AAAA...',
          mock_signed_xdr: 'AAAA...-SIGNED'
        };
        break;
        
      case 'balance':
        // Test balance endpoint
        testResult = {
          success: true,
          message: 'Python bot balance test',
          endpoint: `${pythonBotUrl}/api/balance`,
          mock_balance: '100.0000000'
        };
        break;
        
      default:
        testResult = {
          success: false,
          error: 'Unknown test type'
        };
    }
    
    res.json(testResult);
    
  } catch (error) {
    console.error('❌ Python bot test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the fee collection demo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'fee-collection-demo.html'));
});

// Serve the hybrid signing demo
app.get('/hybrid', (req, res) => {
  res.sendFile(path.join(__dirname, 'hybrid-signing-demo.html'));
});

// Serve the modern wallet page
app.get('/wallet', (req, res) => {
  res.sendFile(path.join(__dirname, 'modern-wallet-ui.html'));
});

// Also serve the original test wallet
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-wallet.html'));
});

app.listen(port, () => {
  console.log(`🚀 Test wallet server running at http://localhost:${port}`);
  console.log(`📱 Open your browser and navigate to: http://localhost:${port}`);
  console.log(`🔧 This simulates your mini-app wallet with Stellar-Plus`);
});
