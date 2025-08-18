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
       
       // Handle referral rewards (if applicable)
       await handleReferralRewards(telegram_id, xlmVolume);
       
     } catch (dbError) {
       console.error('⚠️ Trade logging failed:', dbError);
       // Don't fail the transaction if logging fails
       // Just log the error and continue
     }
    
    // Return Turnkey response to frontend
    res.json({
      success: true,
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

// Handle referral rewards (consistent with Python bot logic)
async function handleReferralRewards(userId, xlmVolume) {
  try {
    // Check if user has a referrer
    const referrerQuery = `
      SELECT referrer_id 
      FROM referrals 
      WHERE referee_id = $1
    `;
    
    const referrerResult = await pool.query(referrerQuery, [userId]);
    
    if (referrerResult.rows.length > 0) {
      const referrerId = referrerResult.rows[0].referrer_id;
      
      // Calculate reward (adjust percentage as needed)
      const rewardPercentage = 0.01; // 1% of XLM volume
      const rewardAmount = xlmVolume * rewardPercentage;
      
      if (rewardAmount > 0) {
        // Insert reward record
        const rewardQuery = `
          INSERT INTO rewards (user_id, amount, status)
          VALUES ($1, $2, 'unpaid')
          ON CONFLICT DO NOTHING
        `;
        
        await pool.query(rewardQuery, [referrerId, rewardAmount]);
        
        console.log(`💰 Referral reward logged: ${rewardAmount} XLM for user ${referrerId}`);
      }
    }
  } catch (error) {
    console.error('⚠️ Referral reward handling failed:', error);
    // Don't fail the transaction if referral handling fails
  }
}

module.exports = router;
