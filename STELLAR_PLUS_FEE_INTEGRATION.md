# 🌟 Stellar-Plus Fee Integration Guide

## 🎯 **Overview**

This guide shows how to integrate the fee collection system with **Stellar-Plus** for client-side signing while mirroring the Python bot's logic exactly.

## 🔧 **Key Components**

### **1. XLM Equivalent Calculation**

The Python bot uses **Stellar paths** to calculate XLM equivalent for non-XLM assets. We need to implement this in the client:

```javascript
// XLM equivalent calculation using Stellar-Plus
async function calculateXlmEquivalent(asset, amount, horizonUrl = 'https://horizon.stellar.org') {
  if (asset.isNative()) {
    return amount; // Already XLM
  }
  
  try {
    // Use Stellar-Plus to get paths
    const pathsResponse = await fetch(
      `${horizonUrl}/paths/strict-send?source_asset_type=credit_alphanum4&source_asset_code=${asset.code}&source_asset_issuer=${asset.issuer}&source_amount=${amount}&destination_assets=native&limit=1`
    );
    
    const pathsData = await pathsResponse.json();
    const paths = pathsData._embedded?.records || [];
    
    if (paths.length > 0) {
      const bestPath = paths[0];
      return parseFloat(bestPath.destination_amount);
    } else {
      console.warn(`No paths found for ${asset.code}:${asset.issuer} to XLM`);
      return 0.0; // Fallback
    }
  } catch (error) {
    console.error(`Error calculating XLM equivalent for ${asset.code}:${asset.issuer}:`, error);
    return 0.0; // Fallback
  }
}
```

### **2. Fee-Aware Transaction Builder**

Create a wrapper around Stellar-Plus that handles fee calculation:

```javascript
// Fee-aware transaction builder
class FeeAwareTransactionBuilder {
  constructor(horizonUrl = 'https://horizon.stellar.org') {
    this.horizonUrl = horizonUrl;
    this.feeWalletAddress = 'YOUR_FEE_WALLET_ADDRESS'; // Set your fee collection address
  }
  
  async buildTransactionWithFees(transaction, context) {
    try {
      // 1. Calculate XLM equivalent for fee calculation
      const xlmEquivalent = await this.calculateXlmEquivalent(
        context.asset, 
        context.amount
      );
      
      // 2. Get fee calculation from Node.js backend
      const feeCalculation = await this.calculateFees({
        telegram_id: context.telegram_id,
        transaction_amount: context.amount,
        transaction_type: context.type,
        asset_code: context.asset.isNative() ? 'XLM' : context.asset.code,
        asset_issuer: context.asset.isNative() ? null : context.asset.issuer,
        xlm_equivalent: xlmEquivalent
      });
      
      // 3. Add fee payment operation to transaction
      const transactionWithFees = await this.addFeeOperation(
        transaction, 
        feeCalculation.calculation.fee
      );
      
      return {
        transaction: transactionWithFees,
        feeCalculation: feeCalculation,
        xlmEquivalent: xlmEquivalent
      };
      
    } catch (error) {
      throw new Error(`Fee calculation failed: ${error.message}`);
    }
  }
  
  async calculateFees(params) {
    const response = await fetch('/mini-app/calculate-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`Fee calculation failed: ${response.status}`);
    }
    
    return await response.json();
  }
  
  async addFeeOperation(transaction, feeAmount) {
    // Add fee payment operation using Stellar-Plus
    const feeOperation = {
      type: 'payment',
      destination: this.feeWalletAddress,
      asset: 'XLM',
      amount: feeAmount.toString()
    };
    
    // Add operation to transaction
    transaction.addOperation(feeOperation);
    
    return transaction;
  }
  
  async calculateXlmEquivalent(asset, amount) {
    if (asset.isNative()) {
      return amount;
    }
    
    try {
      const pathsResponse = await fetch(
        `${this.horizonUrl}/paths/strict-send?source_asset_type=credit_alphanum4&source_asset_code=${asset.code}&source_asset_issuer=${asset.issuer}&source_amount=${amount}&destination_assets=native&limit=1`
      );
      
      const pathsData = await pathsResponse.json();
      const paths = pathsData._embedded?.records || [];
      
      if (paths.length > 0) {
        return parseFloat(paths[0].destination_amount);
      } else {
        console.warn(`No paths found for ${asset.code}:${asset.issuer} to XLM`);
        return 0.0;
      }
    } catch (error) {
      console.error(`Error calculating XLM equivalent:`, error);
      return 0.0;
    }
  }
}
```

### **3. Complete Transaction Flow**

```javascript
// Complete fee-aware transaction flow
async function executeTransactionWithFees(transactionParams) {
  const {
    telegram_id,
    sourceAccount,
    destination,
    asset,
    amount,
    transactionType = 'payment'
  } = transactionParams;
  
  try {
    // 1. Create Stellar-Plus transaction
    const transaction = new stellarPlus.TransactionBuilder(sourceAccount, {
      fee: await stellarPlus.getRecommendedFee(),
      networkPassphrase: stellarPlus.Networks.TESTNET // or PUBLIC
    });
    
    // 2. Add the main operation
    transaction.addOperation(stellarPlus.Operation.payment({
      destination: destination,
      asset: asset,
      amount: amount.toString()
    }));
    
    // 3. Build transaction with fees
    const feeAwareBuilder = new FeeAwareTransactionBuilder();
    const { transaction: transactionWithFees, feeCalculation } = 
      await feeAwareBuilder.buildTransactionWithFees(transaction, {
        telegram_id: telegram_id,
        asset: asset,
        amount: amount,
        type: transactionType
      });
    
    // 4. Show fee preview to user
    const userApproved = await showFeePreview(feeCalculation);
    if (!userApproved) {
      throw new Error('User cancelled transaction');
    }
    
    // 5. Sign transaction (client-side)
    const signedTransaction = await signTransaction(transactionWithFees);
    
    // 6. Submit to network
    const result = await stellarPlus.submitTransaction(signedTransaction);
    
    // 7. Log XLM volume for referrals
    await logXlmVolume({
      telegram_id: telegram_id,
      xlm_volume: feeCalculation.calculation.xlm_volume,
      tx_hash: result.hash,
      action_type: transactionType
    });
    
    // 8. Calculate referral shares if applicable
    if (feeCalculation.user_status.is_referral) {
      await calculateReferralShares({
        telegram_id: telegram_id,
        fee_amount: feeCalculation.calculation.fee
      });
    }
    
    return {
      success: true,
      hash: result.hash,
      fee: feeCalculation.calculation.fee,
      xlmVolume: feeCalculation.calculation.xlm_volume
    };
    
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// Helper functions
async function showFeePreview(feeCalculation) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="fee-preview-modal">
        <h3>💰 Fee Preview</h3>
        <div class="fee-breakdown">
          <p><strong>Transaction Amount:</strong> ${feeCalculation.calculation.transaction_amount} ${feeCalculation.calculation.asset_code}</p>
          <p><strong>XLM Equivalent:</strong> ${feeCalculation.calculation.xlm_volume} XLM</p>
          <p><strong>Fee Rate:</strong> ${(feeCalculation.calculation.fee_percentage * 100).toFixed(2)}%</p>
          <p><strong>Fee Amount:</strong> ${feeCalculation.calculation.fee} XLM</p>
          <p><strong>Total Cost:</strong> ${feeCalculation.calculation.total_amount} ${feeCalculation.calculation.asset_code}</p>
        </div>
        <div class="fee-actions">
          <button onclick="approveTransaction()">✅ Approve & Sign</button>
          <button onclick="cancelTransaction()">❌ Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    window.approveTransaction = () => {
      document.body.removeChild(modal);
      resolve(true);
    };
    
    window.cancelTransaction = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
  });
}

async function logXlmVolume(params) {
  const response = await fetch('/mini-app/log-xlm-volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  if (!response.ok) {
    console.warn('Failed to log XLM volume:', response.status);
  }
  
  return await response.json();
}

async function calculateReferralShares(params) {
  const response = await fetch('/mini-app/calculate-referral-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  if (!response.ok) {
    console.warn('Failed to calculate referral shares:', response.status);
  }
  
  return await response.json();
}
```

## 🎯 **Integration with Stellar-Plus**

### **Asset-to-Asset Swaps**

For asset swaps, you need to calculate XLM equivalent for **both** assets:

```javascript
// Asset swap with fee calculation
async function executeAssetSwap(params) {
  const {
    telegram_id,
    sourceAccount,
    sendAsset,
    sendAmount,
    receiveAsset,
    receiveAmount
  } = params;
  
  // Calculate XLM equivalent for both assets
  const sendXlmEquivalent = await calculateXlmEquivalent(sendAsset, sendAmount);
  const receiveXlmEquivalent = await calculateXlmEquivalent(receiveAsset, receiveAmount);
  
  // Use the larger value for fee calculation (mirrors Python bot logic)
  const xlmVolume = Math.max(sendXlmEquivalent, receiveXlmEquivalent);
  
  // Build path payment transaction
  const transaction = new stellarPlus.TransactionBuilder(sourceAccount, {
    fee: await stellarPlus.getRecommendedFee(),
    networkPassphrase: stellarPlus.Networks.TESTNET
  });
  
  // Add path payment operation
  transaction.addOperation(stellarPlus.Operation.pathPaymentStrictReceive({
    sendAsset: sendAsset,
    sendMax: sendAmount.toString(),
    destination: sourceAccount.publicKey(),
    destAsset: receiveAsset,
    destAmount: receiveAmount.toString(),
    path: [] // Let Stellar find the best path
  }));
  
  // Add fees and complete transaction
  return await executeTransactionWithFees({
    transaction,
    context: {
      telegram_id: telegram_id,
      asset: sendAsset,
      amount: sendAmount,
      type: 'swap',
      xlm_equivalent: xlmVolume
    }
  });
}
```

## 🔄 **Database Schema Requirements**

Make sure you have these tables (mirrors Python bot):

```sql
-- Trades table for volume tracking
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    xlm_volume DECIMAL(20,7) NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    action_type TEXT DEFAULT 'payment',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fees table for fee tracking
CREATE TABLE IF NOT EXISTS fees (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    action_type TEXT NOT NULL,
    amount DECIMAL(20,7) NOT NULL,
    fee DECIMAL(20,7) NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards table for referral payouts
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount DECIMAL(20,7) NOT NULL,
    status TEXT DEFAULT 'unpaid',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## ✅ **Benefits of This Approach**

### **Exact Python Bot Mirroring:**
- ✅ **Same fee percentages** (1%, 0.9%, 0.1%)
- ✅ **Same XLM equivalent calculation** using Stellar paths
- ✅ **Same referral logic** (up to 5 levels, 35%/25% shares)
- ✅ **Same volume tracking** for rewards
- ✅ **Same database schema** for consistency

### **Client-Side Benefits:**
- ✅ **User control** - User signs their own transactions
- ✅ **Transparency** - User sees exact fees before signing
- ✅ **No key exposure** - Server never sees private keys
- ✅ **Real-time calculation** - Fees calculated on-demand

### **Architecture Benefits:**
- ✅ **Single source of truth** - Node.js handles all user logic
- ✅ **Easy maintenance** - One place to update fee rules
- ✅ **Scalable** - Easy to add new discount types
- ✅ **Testable** - Can test endpoints independently

This approach gives you **exactly the same fee logic** as your Python bot while maintaining **user control** over transaction signing! 🎉

