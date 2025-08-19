const express = require('express');
const router = express.Router();
const pool = require('../db');

// Sign transaction and log fees
router.post('/mini-app/sign-transaction', async (req, res) => {
  try {
    const { stamp, requestBody, telegram_id, fee_amount, fee_asset } = req.body;
    
    console.log('🔐 Processing transaction signing request...');
    console.log(`📱 Telegram ID: ${telegram_id}`);
    console.log(`💰 Fee: ${fee_amount} ${fee_asset}`);
    
    // Validate required fields
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
    
         // Log trade to database (consistent with Python bot)
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
       
       // Extract transaction hash from request body
       const txHash = requestBody.parameters?.payload || 'unknown';
       
       // Extract Turnkey activity ID from response
       const activityId = turnkeyResult.activity?.id || 'unknown';
       
       // Calculate XLM volume (you can adjust this based on your needs)
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
       
               // Handle referral rewards (if applicable) - use fee_amount like Python bot
        await handleReferralRewards(telegram_id, fee_amount || 0);
       
     } catch (dbError) {
       console.error('⚠️ Trade logging failed:', dbError);
       // Don't fail the transaction if logging fails
       // Just log the error and continue
     }
    
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

// Handle referral rewards (EXACT same logic as Python bot)
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
