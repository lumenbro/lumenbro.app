// routes/near-test.js - Backend support for NEAR Protocol compatibility testing
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get test configuration (sub-org ID and HD wallet ID)
router.get('/config', async (req, res) => {
  try {
    // Get test sub-org ID from environment or database
    const testSubOrgId = process.env.TEST_SUB_ORG_ID;
    const testHdWalletId = process.env.TEST_HD_WALLET_ID;
    
    if (!testSubOrgId) {
      return res.status(404).json({
        error: 'Test sub-organization ID not configured',
        message: 'Please set TEST_SUB_ORG_ID environment variable'
      });
    }
    
    if (!testHdWalletId) {
      return res.status(404).json({
        error: 'Test HD wallet ID not configured',
        message: 'Please set TEST_HD_WALLET_ID environment variable'
      });
    }
    
    res.json({
      success: true,
      config: {
        testSubOrgId,
        testHdWalletId,
        network: 'testnet',
        rpcUrl: 'https://rpc.testnet.near.org'
      }
    });
    
  } catch (error) {
    console.error('Error fetching NEAR test config:', error);
    res.status(500).json({
      error: 'Failed to fetch test configuration',
      message: error.message
    });
  }
});

// Get existing HD wallet accounts for the test sub-org
router.get('/wallet-accounts/:subOrgId', async (req, res) => {
  try {
    const { subOrgId } = req.params;
    
    // Query database for existing wallet accounts
    const result = await pool.query(
      `SELECT tw.turnkey_key_id, tw.public_key, tw.is_active 
       FROM turnkey_wallets tw 
       WHERE tw.turnkey_sub_org_id = $1 AND tw.is_active = TRUE`,
      [subOrgId]
    );
    
    res.json({
      success: true,
      accounts: result.rows.map(row => ({
        keyId: row.turnkey_key_id,
        publicKey: row.public_key,
        isActive: row.is_active
      }))
    });
    
  } catch (error) {
    console.error('Error fetching wallet accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch wallet accounts',
      message: error.message
    });
  }
});

// Log NEAR test results for monitoring
router.post('/log-result', async (req, res) => {
  try {
    const { 
      testType, 
      success, 
      accountId, 
      publicKey, 
      nearAddress, 
      transactionHash, 
      error 
    } = req.body;
    
    console.log('NEAR Test Result:', {
      timestamp: new Date().toISOString(),
      testType,
      success,
      accountId,
      publicKey: publicKey ? publicKey.substring(0, 20) + '...' : null,
      nearAddress,
      transactionHash,
      error
    });
    
    res.json({
      success: true,
      message: 'Test result logged successfully'
    });
    
  } catch (error) {
    console.error('Error logging NEAR test result:', error);
    res.status(500).json({
      error: 'Failed to log test result',
      message: error.message
    });
  }
});

module.exports = router;
