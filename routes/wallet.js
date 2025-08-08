const express = require('express');
const router = express.Router();

// Import Stellar SDK with correct destructuring
const { Server, Keypair, Transaction, Networks } = require('@stellar/stellar-sdk');

// Stellar SDK setup
const server = new Server('https://horizon-testnet.stellar.org');

// Get account info endpoint
router.get('/wallet/account/:publicKey', async (req, res) => {
  const { publicKey } = req.params;
  
  try {
    // Validate the public key format
    Keypair.fromPublicKey(publicKey);
    
    const account = await server.loadAccount(publicKey);
    
    // Extract relevant account info
    const accountInfo = {
      accountId: account.accountId(),
      sequence: account.sequenceNumber(),
      balances: account.balances.map(balance => ({
        assetType: balance.asset_type,
        assetCode: balance.asset_code || 'XLM',
        balance: balance.balance,
        limit: balance.limit
      }))
    };
    
    res.json(accountInfo);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ error: 'Account not found (unfunded)' });
    } else if (error.name === 'InvalidSeed') {
      res.status(400).json({ error: 'Invalid public key format' });
    } else {
      console.error('Account lookup error:', error);
      res.status(500).json({ error: 'Failed to load account' });
    }
  }
});

// Submit signed transaction endpoint
router.post('/wallet/submit-transaction', async (req, res) => {
  const { signedTransaction } = req.body;
  
  if (!signedTransaction) {
    return res.status(400).json({ error: 'Missing signed transaction' });
  }
  
  try {
    // Parse and submit the transaction
    const transaction = new Transaction(signedTransaction, Networks.TESTNET);
    const result = await server.submitTransaction(transaction);
    
    res.json({
      success: true,
      hash: result.hash,
      ledger: result.ledger,
      result: result
    });
  } catch (error) {
    console.error('Transaction submission error:', error);
    res.status(400).json({ 
      error: 'Transaction failed',
      details: error.response?.data || error.message 
    });
  }
});

// Fund testnet account (for development only)
router.post('/wallet/fund-testnet/:publicKey', async (req, res) => {
  const { publicKey } = req.params;
  
  try {
    // Validate the public key
    Keypair.fromPublicKey(publicKey);
    
    // Use Stellar's friendbot to fund the account
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    
    if (response.ok) {
      res.json({ success: true, message: 'Account funded with 10,000 XLM' });
    } else {
      throw new Error('Friendbot funding failed');
    }
  } catch (error) {
    console.error('Funding error:', error);
    res.status(500).json({ error: 'Failed to fund account' });
  }
});

module.exports = router;
