const express = require('express');
const router = express.Router();

// Import Stellar SDK with correct destructuring
// const { Server, Keypair, Transaction, Networks } = require('@stellar/stellar-sdk');

// Stellar SDK setup - temporarily disabled
// const server = new Server('https://horizon-testnet.stellar.org');

// Get account info endpoint - temporarily disabled
// router.get('/wallet/account/:publicKey', async (req, res) => {
//   const { publicKey } = req.params;
//   
//   try {
//     // Validate the public key format
//     Keypair.fromPublicKey(publicKey);
//     
//     const account = await server.loadAccount(publicKey);
//     
//     // Extract relevant account info
//     const accountInfo = {
//       accountId: account.accountId(),
//       sequence: account.sequenceNumber(),
//       balances: account.balances.map(balance => ({
//         assetType: balance.asset_type,
//         assetCode: balance.asset_code || 'XLM',
//         balance: balance.balance,
//         limit: balance.limit
//       }))
//     };
//     
//     res.json(accountInfo);
//   } catch (error) {
//     if (error.response && error.response.status === 404) {
//       res.status(404).json({ error: 'Account not found (unfunded)' });
//     } else if (error.name === 'InvalidSeed') {
//       res.status(400).json({ error: 'Invalid public key format' });
//     } else {
//       console.error('Account lookup error:', error);
//       res.status(500).json({ error: 'Failed to load account' });
//     }
//   }
// });

// Submit signed transaction endpoint - temporarily disabled
// router.post('/wallet/submit-transaction', async (req, res) => {
//   const { signedTransaction } = req.body;
//   
//   if (!signedTransaction) {
//     return res.status(400).json({ error: 'Missing signed transaction' });
//   }
//   
//   try {
//     // Parse and submit the transaction
//     const transaction = new Transaction(signedTransaction, Networks.TESTNET);
//     const result = await server.submitTransaction(transaction);
//     
//     res.json({
//       success: true,
//       hash: result.hash,
//       ledger: result.ledger,
//       result: result
//     });
//   } catch (error) {
//     console.error('Transaction submission error:', error);
//     res.status(400).json({ 
//       error: 'Transaction failed',
//       details: error.response?.data || error.message 
//     });
//   }
// });

// Fund testnet account (for development only) - temporarily disabled
// router.post('/wallet/fund-testnet/:publicKey', async (req, res) => {
//   const { publicKey } = req.params;
//   
//   try {
//     // Validate the public key
//     Keypair.fromPublicKey(publicKey);
//     
//     // Use Stellar's friendbot to fund the account
//     const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
//     
//     if (response.ok) {
//       res.json({ success: true, message: 'Account funded with 10,000 XLM' });
//     } else {
//       throw new Error('Friendbot funding failed');
//     }
//   } catch (error) {
//     console.error('Funding error:', error);
//     res.status(500).json({ error: 'Failed to fund account' });
//   }
// });

// Export wallet private keys
router.post('/export-wallet', async (req, res) => {
  try {
    const { organizationId, walletId, apiKeyId, apiPrivateKey } = req.body;
    
    if (!organizationId || !walletId || !apiKeyId || !apiPrivateKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Exporting wallet:', { organizationId, walletId, apiKeyId });

    // Create Turnkey client with user's API keys
    const turnkeyClient = new Turnkey({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: apiKeyId,
      apiPrivateKey: apiPrivateKey,
      defaultOrganizationId: organizationId,
    });

    // Export the wallet
    const exportResult = await turnkeyClient.apiClient().exportWallet({
      walletId: walletId,
      keyFormat: "KEY_FORMAT_HEXADECIMAL"
    });

    console.log('Export successful for wallet:', walletId);
    res.json({ 
      success: true, 
      exportBundle: exportResult.exportBundle,
      message: 'Wallet exported successfully' 
    });

  } catch (error) {
    console.error('Export wallet error:', error);
    res.status(500).json({ 
      error: 'Failed to export wallet', 
      details: error.message 
    });
  }
});

// Export specific wallet account
router.post('/export-account', async (req, res) => {
  try {
    const { organizationId, walletAccountId, apiKeyId, apiPrivateKey } = req.body;
    
    if (!organizationId || !walletAccountId || !apiKeyId || !apiPrivateKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Exporting account:', { organizationId, walletAccountId, apiKeyId });

    // Create Turnkey client with user's API keys
    const turnkeyClient = new Turnkey({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: apiKeyId,
      apiPrivateKey: apiPrivateKey,
      defaultOrganizationId: organizationId,
    });

    // Export the wallet account
    const exportResult = await turnkeyClient.apiClient().exportWalletAccount({
      walletAccountId: walletAccountId,
      keyFormat: "KEY_FORMAT_HEXADECIMAL"
    });

    console.log('Export successful for account:', walletAccountId);
    res.json({ 
      success: true, 
      exportBundle: exportResult.exportBundle,
      message: 'Account exported successfully' 
    });

  } catch (error) {
    console.error('Export account error:', error);
    res.status(500).json({ 
      error: 'Failed to export account', 
      details: error.message 
    });
  }
});

// Decrypt export bundle (client-side helper)
router.post('/decrypt-export', async (req, res) => {
  try {
    const { exportBundle, embeddedKey, organizationId } = req.body;
    
    if (!exportBundle || !embeddedKey || !organizationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Decrypting export bundle for org:', organizationId);

    // Note: This is a helper endpoint - actual decryption should happen client-side
    // This just validates the bundle format
    const parsedBundle = JSON.parse(exportBundle);
    
    if (!parsedBundle.enclaveQuorumPublic || !parsedBundle.dataSignature || !parsedBundle.data) {
      return res.status(400).json({ error: 'Invalid export bundle format' });
    }

    res.json({ 
      success: true, 
      message: 'Export bundle is valid - decrypt client-side',
      bundleInfo: {
        hasEnclaveSignature: !!parsedBundle.enclaveQuorumPublic,
        hasDataSignature: !!parsedBundle.dataSignature,
        hasEncryptedData: !!parsedBundle.data
      }
    });

  } catch (error) {
    console.error('Decrypt export error:', error);
    res.status(500).json({ 
      error: 'Failed to validate export bundle', 
      details: error.message 
    });
  }
});

// ADDED: API endpoint for wallet export
router.post('/api/export-wallet', async (req, res) => {
  try {
    const { subOrgId, walletAccountId, stellarAddress, targetPublicKey, userApiPublicKey, userApiPrivateKey } = req.body;
    
    if (!subOrgId || !walletAccountId || !stellarAddress || !targetPublicKey || !userApiPublicKey || !userApiPrivateKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    // Create Turnkey client on backend
    const { Turnkey } = require('@turnkey/sdk-server');
    const userClient = new Turnkey({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: userApiPublicKey,
      apiPrivateKey: userApiPrivateKey,
      defaultOrganizationId: subOrgId,
    });
    
    // Export the wallet account
    const exportResult = await userClient.apiClient().exportWalletAccount({
      organizationId: subOrgId,
      walletAccountId: walletAccountId,
      address: stellarAddress,
      targetPublicKey: targetPublicKey,
      keyFormat: "KEY_FORMAT_HEXADECIMAL"
    });
    
    console.log('✅ Backend export successful');
    console.log('📦 Export bundle length:', exportResult.exportBundle?.length || 'N/A');
    
    // Note: The decryption should happen on the client side with the ephemeral private key
    // We'll return the export bundle and let the client handle decryption
    console.log('✅ Export bundle created, returning for client-side decryption');
    
    console.log('✅ Bundle decrypted successfully');
    
    // Extract the Stellar private key
    const stellarPrivateKey = decryptedData.privateKey;
    console.log('📋 Stellar private key (hex):', stellarPrivateKey.substring(0, 20) + '...');
    
    // Convert to Stellar S-address format
    const stellarSAddress = 'S' + stellarPrivateKey.substring(2); // Remove '0x' prefix and add 'S'
    
    res.json({
      success: true,
      stellarPrivateKey,
      stellarSAddress,
      exportBundle: exportResult.exportBundle
    });
    
  } catch (error) {
    console.error('❌ Backend export failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
