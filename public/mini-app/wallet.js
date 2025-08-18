// wallet.js - Transaction signing with fee logging integration

class WalletTransactionSigner {
  constructor() {
    this.telegramId = null;
    this.userData = null;
  }

  // Initialize with user data
  async initialize(telegramId) {
    this.telegramId = telegramId;
    
    // Get user's Turnkey data from your existing system
    try {
      const response = await fetch(`/api/user-data/${telegramId}`);
      const data = await response.json();
      
      if (data.success) {
        this.userData = data.user;
        console.log('✅ Wallet signer initialized with user data');
        return true;
      } else {
        throw new Error('Failed to get user data');
      }
    } catch (error) {
      console.error('❌ Failed to initialize wallet signer:', error);
      return false;
    }
  }

  // Sign a transaction with fee logging
  async signTransaction(txHash, feeAmount, feeAsset) {
    try {
      console.log('🔐 Starting transaction signing...');
      
      // 1. Get user's password
      const password = await this.promptPassword();
      if (!password) {
        throw new Error('Password required for transaction signing');
      }

      // 2. Decrypt API keys
      const apiKey = await window.EncryptionUtils.retrieveTelegramKey(password);
      console.log('✅ API keys decrypted');

      // 3. Create stamper using existing proven method
      const stamper = createManualStamper(apiKey.apiPrivateKey, apiKey.apiPublicKey);
      console.log('✅ ManualStamper created');

      // 4. Create Turnkey request body
      const requestBody = {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        timestampMs: Date.now().toString(),
        organizationId: this.userData.turnkey_sub_org_id,
        parameters: {
          signWith: this.userData.turnkey_key_id,
          payload: txHash,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_NO_OP"
        }
      };

      console.log('📋 Request body created');

      // 5. Create stamp
      const payload = JSON.stringify(requestBody);
      const stamp = await stamper.stamp(payload);
      console.log('✅ Stamp created');

      // 6. Send to backend with fee logging
      const response = await fetch('/mini-app/sign-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stamp,
          requestBody,
          telegram_id: this.telegramId,
          fee_amount: feeAmount,
          fee_asset: feeAsset
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Transaction signing failed: ${result.error}`);
      }

      console.log('✅ Transaction signed successfully');
      console.log(`💰 Fee logged: ${result.fee_logged ? 'Yes' : 'No'}`);

      return {
        success: true,
        turnkey_response: result.turnkey_response,
        fee_logged: result.fee_logged
      };

    } catch (error) {
      console.error('❌ Transaction signing failed:', error);
      throw error;
    }
  }

  // Get transaction history (consistent with Python bot)
  async getTransactionHistory() {
    try {
      const response = await fetch(`/mini-app/transaction-history/${this.telegramId}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Failed to get transaction history: ${result.error}`);
      }

      return result.transactions;
    } catch (error) {
      console.error('❌ Failed to get transaction history:', error);
      throw error;
    }
  }

  // Get user rewards (consistent with Python bot)
  async getUserRewards() {
    try {
      const response = await fetch(`/mini-app/user-rewards/${this.telegramId}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Failed to get user rewards: ${result.error}`);
      }

      return result.rewards;
    } catch (error) {
      console.error('❌ Failed to get user rewards:', error);
      throw error;
    }
  }

  // Helper: Password prompt (you can customize this)
  async promptPassword() {
    // In a real app, this might be a modal or secure input
    return prompt('Enter your password to sign the transaction:');
  }
}

// Example usage:
/*
const signer = new WalletTransactionSigner();
await signer.initialize(telegramId);

// Sign a transaction
const result = await signer.signTransaction(
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  0.0001,
  'XLM'
);

// Get transaction history (consistent with Python bot)
const history = await signer.getTransactionHistory();

// Get user rewards (consistent with Python bot)
const rewards = await signer.getUserRewards();
*/
