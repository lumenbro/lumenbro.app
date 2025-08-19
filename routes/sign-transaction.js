const express = require('express');
const router = express.Router();
const pool = require('../db');
const { StellarSdk } = require('@stellar/stellar-sdk');

// Enhanced user status checking and fee calculation
router.get('/mini-app/user-status/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    
    console.log(`🔍 Checking user status for ${telegram_id}`);
    
    // Get user info from database
    const userQuery = `
      SELECT 
        telegram_id,
        pioneer_status,
        session_expiry,
        turnkey_user_id,
        user_email
      FROM users 
      WHERE telegram_id = $1
    `;
    
    const userResult = await pool.query(userQuery, [telegram_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        needsRegistration: true
      });
    }
    
    const user = userResult.rows[0];
    const now = new Date();
    const sessionExpired = user.session_expiry && new Date(user.session_expiry) < now;
    
    // Calculate user tier and fees based on status
    let userTier = 'standard';
    let feeMultiplier = 1.0;
    let maxTransactionLimit = 1000; // XLM
    
    if (user.pioneer_status) {
      userTier = 'pioneer';
      feeMultiplier = 0.5; // 50% discount
      maxTransactionLimit = 10000; // XLM
    }
    
    // Get recent trading volume for dynamic fee calculation
    const volumeQuery = `
      SELECT SUM(xlm_volume) as total_volume
      FROM trades 
      WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '30 days'
    `;
    
    const volumeResult = await pool.query(volumeQuery, [telegram_id]);
    const monthlyVolume = parseFloat(volumeResult.rows[0]?.total_volume || 0);
    
    // Adjust fees based on volume
    if (monthlyVolume > 50000) {
      feeMultiplier *= 0.8; // Additional 20% discount for high volume
    }
    
    // Calculate base fees
    const baseNetworkFee = 0.00001; // 100 stroops
    const baseServiceFee = 0.00001; // 100 stroops
    
    const fees = {
      networkFee: baseNetworkFee * feeMultiplier,
      serviceFee: baseServiceFee * feeMultiplier,
      total: (baseNetworkFee + baseServiceFee) * feeMultiplier,
      multiplier: feeMultiplier,
      tier: userTier
    };
    
    res.json({
      success: true,
      user: {
        telegram_id: user.telegram_id,
        tier: userTier,
        pioneer_status: user.pioneer_status,
        session_active: !sessionExpired,
        email: user.user_email,
        monthly_volume: monthlyVolume,
        max_transaction_limit: maxTransactionLimit
      },
      fees: fees,
      limits: {
        maxTransaction: maxTransactionLimit,
        dailyLimit: maxTransactionLimit * 10,
        monthlyLimit: maxTransactionLimit * 100
      }
    });
    
  } catch (error) {
    console.error('❌ User status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check user status',
      details: error.message 
    });
  }
});

// Enhanced transaction building with path payments
router.post('/mini-app/build-transaction', async (req, res) => {
  try {
    const { 
      sourcePublicKey, 
      transactionData, 
      telegram_id,
      operationType = 'payment' // payment, pathPaymentStrictSend, pathPaymentStrictReceive
    } = req.body;
    
    console.log('🔨 Building transaction...');
    console.log(`📱 Telegram ID: ${telegram_id}`);
    console.log(`🔧 Operation Type: ${operationType}`);
    
    // Validate user status and get fees
    const userStatusResponse = await fetch(`${req.protocol}://${req.get('host')}/mini-app/user-status/${telegram_id}`);
    const userStatus = await userStatusResponse.json();
    
    if (!userStatus.success) {
      return res.status(400).json({ error: 'Invalid user status' });
    }
    
    // Check transaction limits
    const amount = parseFloat(transactionData.amount || transactionData.sendAmount || 0);
    if (amount > userStatus.limits.maxTransaction) {
      return res.status(400).json({ 
        error: `Transaction amount exceeds limit of ${userStatus.limits.maxTransaction} XLM` 
      });
    }
    
    // Build transaction based on operation type
    let transaction;
    const server = new StellarSdk.Server('https://horizon.stellar.org');
    const account = await server.loadAccount(sourcePublicKey);
    
    const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.PUBLIC
    });
    
    switch (operationType) {
      case 'payment':
        const paymentOp = StellarSdk.Operation.payment({
          destination: transactionData.recipient,
          asset: transactionData.asset === 'XLM' ? 
            StellarSdk.Asset.native() : 
            new StellarSdk.Asset(transactionData.asset, transactionData.assetIssuer),
          amount: transactionData.amount
        });
        transactionBuilder.addOperation(paymentOp);
        break;
        
      case 'pathPaymentStrictSend':
        const strictSendOp = StellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: transactionData.sendAsset === 'XLM' ? 
            StellarSdk.Asset.native() : 
            new StellarSdk.Asset(transactionData.sendAsset, transactionData.sendAssetIssuer),
          sendAmount: transactionData.sendAmount,
          destination: transactionData.destination,
          destAsset: transactionData.destAsset === 'XLM' ? 
            StellarSdk.Asset.native() : 
            new StellarSdk.Asset(transactionData.destAsset, transactionData.destAssetIssuer),
          destMin: transactionData.destMin,
          path: (transactionData.path || []).map(asset => 
            asset === 'XLM' ? StellarSdk.Asset.native() : 
            new StellarSdk.Asset(asset.code, asset.issuer)
          )
        });
        transactionBuilder.addOperation(strictSendOp);
        break;
        
      case 'pathPaymentStrictReceive':
        const strictReceiveOp = StellarSdk.Operation.pathPaymentStrictReceive({
          sendAsset: transactionData.sendAsset === 'XLM' ? 
            StellarSdk.Asset.native() : 
            new StellarSdk.Asset(transactionData.sendAsset, transactionData.sendAssetIssuer),
          sendMax: transactionData.sendMax,
          destination: transactionData.destination,
          destAsset: transactionData.destAsset === 'XLM' ? 
            StellarSdk.Asset.native() : 
            new StellarSdk.Asset(transactionData.destAsset, transactionData.destAssetIssuer),
          destAmount: transactionData.destAmount,
          path: (transactionData.path || []).map(asset => 
            asset === 'XLM' ? StellarSdk.Asset.native() : 
            new StellarSdk.Asset(asset.code, asset.issuer)
          )
        });
        transactionBuilder.addOperation(strictReceiveOp);
        break;
        
      case 'changeTrust':
        const trustOp = StellarSdk.Operation.changeTrust({
          asset: new StellarSdk.Asset(transactionData.asset, transactionData.issuer),
          limit: transactionData.limit || '922337203685.4775807'
        });
        transactionBuilder.addOperation(trustOp);
        break;
        
      default:
        return res.status(400).json({ error: 'Unsupported operation type' });
    }
    
    // Add memo if provided
    if (transactionData.memo) {
      transactionBuilder.addMemo(StellarSdk.Memo.text(transactionData.memo));
    }
    
    // Set timeout
    transactionBuilder.setTimeout(30);
    
    // Build the transaction
    transaction = transactionBuilder.build();
    
    // Get XDR
    const xdr = transaction.toXDR();
    
    // Calculate fees
    const fees = {
      networkFee: userStatus.fees.networkFee,
      serviceFee: userStatus.fees.serviceFee,
      total: userStatus.fees.total,
      tier: userStatus.fees.tier
    };
    
    res.json({
      success: true,
      xdr: xdr,
      transaction: {
        ...transactionData,
        source: sourcePublicKey,
        fee: fees.total,
        operationType: operationType
      },
      fees: fees,
      userStatus: userStatus.user
    });
    
  } catch (error) {
    console.error('❌ Transaction building error:', error);
    res.status(500).json({ 
      error: 'Failed to build transaction',
      details: error.message 
    });
  }
});

// Enhanced path payment simulation
router.post('/mini-app/simulate-path-payment', async (req, res) => {
  try {
    const { 
      sourcePublicKey, 
      sendAsset, 
      sendAmount, 
      destination, 
      destAsset, 
      destMin,
      path = [],
      telegram_id 
    } = req.body;
    
    console.log('🔄 Simulating path payment...');
    console.log(`📱 Telegram ID: ${telegram_id}`);
    
    // Validate user status
    const userStatusResponse = await fetch(`${req.protocol}://${req.get('host')}/mini-app/user-status/${telegram_id}`);
    const userStatus = await userStatusResponse.json();
    
    if (!userStatus.success) {
      return res.status(400).json({ error: 'Invalid user status' });
    }
    
    // Simulate path payment using Stellar SDK
    const server = new StellarSdk.Server('https://horizon.stellar.org');
    
    // Build path payment operation
    const pathPaymentOp = StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: sendAsset === 'XLM' ? 
        StellarSdk.Asset.native() : 
        new StellarSdk.Asset(sendAsset.code, sendAsset.issuer),
      sendAmount: sendAmount,
      destination: destination,
      destAsset: destAsset === 'XLM' ? 
        StellarSdk.Asset.native() : 
        new StellarSdk.Asset(destAsset.code, destAsset.issuer),
      destMin: destMin,
      path: path.map(asset => 
        asset === 'XLM' ? StellarSdk.Asset.native() : 
        new StellarSdk.Asset(asset.code, asset.issuer)
      )
    });
    
    // Create a dummy account for simulation
    const dummyAccount = new StellarSdk.Account(sourcePublicKey, '0');
    
    // Build transaction for simulation
    const transaction = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.PUBLIC
    })
    .addOperation(pathPaymentOp)
    .setTimeout(30)
    .build();
    
    // Simulate the transaction
    const simulation = await server.simulateTransaction(transaction);
    
    // Extract simulation results
    const result = {
      success: true,
      simulation: {
        minReceived: simulation.result?.minReceived,
        maxReceived: simulation.result?.maxReceived,
        feeCharged: simulation.feeCharged,
        path: simulation.result?.path || [],
        success: simulation.result?.success || false
      },
      fees: {
        networkFee: userStatus.fees.networkFee,
        serviceFee: userStatus.fees.serviceFee,
        total: userStatus.fees.total + parseFloat(simulation.feeCharged || 0)
      },
      limits: userStatus.limits
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Path payment simulation error:', error);
    res.status(500).json({ 
      error: 'Failed to simulate path payment',
      details: error.message 
    });
  }
});

// Enhanced transaction signing with client-side support
router.post('/mini-app/sign-transaction', async (req, res) => {
  try {
    const { stamp, requestBody, telegram_id, fee_amount, fee_asset, clientSignedXdr } = req.body;
    
    console.log('🔐 Processing transaction signing request...');
    console.log(`📱 Telegram ID: ${telegram_id}`);
    console.log(`💰 Fee: ${fee_amount} ${fee_asset}`);
    console.log(`🖥️ Client signed: ${!!clientSignedXdr}`);
    
    // If client provided signed XDR, validate and use it
    if (clientSignedXdr) {
      console.log('✅ Using client-signed XDR');
      
      // Validate the signed XDR
      try {
        const transaction = StellarSdk.TransactionBuilder.fromXDR(clientSignedXdr, StellarSdk.Networks.PUBLIC);
        console.log('✅ Client-signed XDR validation successful');
        
        // Log trade to database
        await logTradeToDatabase(telegram_id, clientSignedXdr, 'client-signed', fee_amount, fee_asset);
        
        // Handle referral rewards
        await handleReferralRewards(telegram_id, fee_amount || 0);
        
        return res.json({
          success: true,
          signed_xdr: clientSignedXdr,
          source: 'client',
          fee_logged: !!(fee_amount && fee_asset)
        });
        
      } catch (validationError) {
        console.error('❌ Client-signed XDR validation failed:', validationError);
        return res.status(400).json({ 
          error: 'Invalid client-signed XDR',
          details: validationError.message 
        });
      }
    }
    
    // Fallback to server-side signing with Turnkey
    if (!stamp || !requestBody || !telegram_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: stamp, requestBody, telegram_id' 
      });
    }
    
    // Forward to Turnkey with stamp
    console.log('📡 Forwarding to Turnkey API...');
    const turnkeyResponse = await fetch('https://api.turnkey.com/v1/activities', {
      method: 'POST',
      headers: {
        'X-Stamp': JSON.stringify(stamp),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const turnkeyResult = await turnkeyResponse.json();
    
    if (!turnkeyResponse.ok) {
      console.error('❌ Turnkey API error:', turnkeyResult);
      return res.status(turnkeyResponse.status).json(turnkeyResult);
    }
    
    console.log('✅ Turnkey signing successful');
    
    // Log trade to database
    await logTradeToDatabase(telegram_id, requestBody.parameters?.payload || 'unknown', turnkeyResult.activity?.id || 'unknown', fee_amount, fee_asset);
    
    // Handle referral rewards
    await handleReferralRewards(telegram_id, fee_amount || 0);
    
    // Extract signed XDR from Turnkey response
    const signedXdr = turnkeyResult.activity?.result?.signRawPayloadResult?.signedPayload || null;
    
    if (!signedXdr) {
      console.error('❌ No signed XDR in Turnkey response');
      return res.status(500).json({ 
        error: 'No signed XDR received from Turnkey',
        details: turnkeyResult 
      });
    }
    
    // Return signed XDR to frontend
    res.json({
      success: true,
      signed_xdr: signedXdr,
      turnkey_response: turnkeyResult,
      source: 'server',
      fee_logged: !!(fee_amount && fee_asset)
    });
    
  } catch (error) {
    console.error('❌ Transaction signing error:', error);
    res.status(500).json({ 
      error: 'Transaction signing failed',
      details: error.message 
    });
  }
});

// Enhanced trade logging function
async function logTradeToDatabase(telegram_id, txHash, activityId, fee_amount, fee_asset) {
     try {
       console.log('💾 Logging trade to database...');
       
       const tradeLogQuery = `
         INSERT INTO trades (
           user_id, 
           xlm_volume,
           tx_hash,
           turnkey_activity_id,
           fee_amount,
           fee_asset,
           timestamp
         ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       `;
       
    // Calculate XLM volume
       const xlmVolume = fee_asset === 'XLM' ? fee_amount : 0;
       
       await pool.query(tradeLogQuery, [
         telegram_id,
         xlmVolume,
         txHash,
         activityId,
         fee_amount || 0,
         fee_asset || 'XLM'
       ]);
       
       console.log('✅ Trade logged successfully');
       
     } catch (dbError) {
       console.error('⚠️ Trade logging failed:', dbError);
       // Don't fail the transaction if logging fails
  }
}

// Get user's transaction history (consistent with Python bot)
router.get('/mini-app/transaction-history/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    
    const query = `
      SELECT 
        xlm_volume,
        tx_hash,
        turnkey_activity_id,
        fee_amount,
        fee_asset,
        timestamp as created_at
      FROM trades 
      WHERE user_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 50
    `;
    
    const result = await pool.query(query, [telegram_id]);
    
    res.json({
      success: true,
      transactions: result.rows
    });
    
  } catch (error) {
    console.error('❌ Transaction history error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transaction history',
      details: error.message 
    });
  }
});

// Get user's rewards (consistent with Python bot)
router.get('/mini-app/user-rewards/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    
    const query = `
      SELECT 
        amount,
        status,
        paid_at,
        created_at
      FROM rewards 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    
    const result = await pool.query(query, [telegram_id]);
    
    res.json({
      success: true,
      rewards: result.rows
    });
    
  } catch (error) {
    console.error('❌ Rewards history error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rewards history',
      details: error.message 
    });
  }
});

// Enhanced referral rewards with volume-based calculations
async function handleReferralRewards(userId, feeAmount) {
  try {
    console.log(`🔗 Calculating referral shares for user ${userId}, fee: ${feeAmount}`);
    
    // Get the referrer chain (up to 5 levels) - EXACT same as Python bot
    const referrerChain = [];
    let currentUser = userId;
    
    for (let level = 0; level < 5; level++) {
      const referrerQuery = `
        SELECT referrer_id 
        FROM referrals 
        WHERE referee_id = $1
      `;
      
      const referrerResult = await pool.query(referrerQuery, [currentUser]);
      
      if (referrerResult.rows.length === 0) {
        break; // No more referrers in chain
      }
      
      const referrerId = referrerResult.rows[0].referrer_id;
      referrerChain.push(referrerId);
      currentUser = referrerId;
    }
    
    console.log(`📊 Referrer chain for user ${userId}: ${referrerChain}`);
    
    // Calculate the user's trading volume for the past week - EXACT same as Python bot
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const volumeQuery = `
      SELECT SUM(xlm_volume) 
      FROM trades 
      WHERE user_id = $1 AND timestamp >= $2
    `;
    
    const volumeResult = await pool.query(volumeQuery, [userId, oneWeekAgo]);
    const userVolume = parseFloat(volumeResult.rows[0]?.sum || 0);
    
    console.log(`📈 User ${userId} trading volume (past week): ${userVolume} XLM`);
    
    // Determine the share percentage based on volume - EXACT same as Python bot
    const sharePercentage = userVolume >= 100000 ? 0.35 : 0.25; // $10,000 in XLM (assuming 1 XLM = $0.10)
    console.log(`💰 Share percentage for user ${userId}: ${sharePercentage * 100}%`);
    
    // Distribute shares across the referrer chain - EXACT same as Python bot
    for (let level = 0; level < referrerChain.length; level++) {
      const referrerId = referrerChain[level];
      const levelShare = sharePercentage * (1 - 0.05 * level); // Decrease by 5% per level
      
      if (levelShare <= 0) {
        console.log(`⚠️ Level share for referrer ${referrerId} at level ${level + 1} is <= 0, skipping`);
        break;
      }
      
      const amount = feeAmount * levelShare;
      console.log(`🎯 Level ${level + 1} share for referrer ${referrerId}: ${levelShare * 100}% = ${amount} XLM`);
      
      if (amount > 0) {
        // Insert reward record - EXACT same as Python bot
        const rewardQuery = `
          INSERT INTO rewards (user_id, amount, status)
          VALUES ($1, $2, 'unpaid')
        `;
        
        await pool.query(rewardQuery, [referrerId, amount]);
        console.log(`✅ Successfully logged referral fee for referrer ${referrerId}: ${amount} XLM`);
      }
    }
    
  } catch (error) {
    console.error('⚠️ Referral reward handling failed:', error);
    // Don't fail the transaction if referral handling fails
  }
}

module.exports = router;
