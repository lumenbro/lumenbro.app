// transaction-manager.js - Transaction management
// Handles: Transaction building, signing, submission

window.TransactionManager = {
  // Transaction state
  currentTransaction: null,
  transactionManager: null,
  
  // Core functions
  buildAndSignTransaction,
  signAndSubmitTransaction,
  signTransactionWithPassword,
  signTransactionWithSession,
  buildTransactionXDR,
  calculateProperFees,
  
  // Transaction utilities
  validateTransaction,
  formatTransactionData,
  getTelegramId,
  submitTransactionToNetwork,
  logTransactionToBackend,
  buildXDRWithBackend,
  constructSignedXdr,
  
  // Initialization
  init: function() {
    console.log('💳 TransactionManager initialized');
    console.log('✅ TransactionManager module loaded successfully');
    console.log('💳 Available transaction functions:', {
      buildAndSignTransaction: typeof this.buildAndSignTransaction,
      signAndSubmitTransaction: typeof this.signAndSubmitTransaction,
      signTransactionWithPassword: typeof this.signTransactionWithPassword,
      signTransactionWithSession: typeof this.signTransactionWithSession,
      buildTransactionXDR: typeof this.buildTransactionXDR,
      calculateProperFees: typeof this.calculateProperFees,
      validateTransaction: typeof this.validateTransaction,
      formatTransactionData: typeof this.formatTransactionData,
      getTelegramId: typeof this.getTelegramId,
      submitTransactionToNetwork: typeof this.submitTransactionToNetwork,
      logTransactionToBackend: typeof this.logTransactionToBackend,
      buildXDRWithBackend: typeof this.buildXDRWithBackend,
      constructSignedXdr: typeof this.constructSignedXdr
    });
  }
};

// Transaction functions migrated from index.html

async function buildAndSignTransaction() {
  try {
    const recipientAddress = document.getElementById('recipientAddress').value.trim();  
    const assetValue = document.getElementById('assetSelect').value;
    const amount = document.getElementById('amount').value;
    const memo = document.getElementById('memo').value.trim();

    // Parse asset information
    let asset;
    if (assetValue === 'XLM') {
      asset = 'XLM';
    } else {
      try {
        asset = JSON.parse(assetValue);
      } catch (error) {
        console.error('Failed to parse asset info:', error);
        alert('Invalid asset selection');
        return;
      }
    }

    // Validation
    if (!recipientAddress || !amount) {
      alert('Please fill in recipient address and amount');
      return;
    }

    if (!recipientAddress.startsWith('G')) {
      alert('Invalid Stellar address. Must start with G');
      return;
    }

    // Show loading state
    const sendButton = document.querySelector('.btn-primary');
    const originalText = sendButton.textContent;
    sendButton.textContent = '⏳ Building Transaction...';
    sendButton.disabled = true;

    // Build transaction on server
    const response = await fetch('/mini-app/build-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: recipientAddress,
        asset: asset,
        amount: amount,
        memo: memo
      })
    });

    if (!response.ok) {
      throw new Error('Failed to build transaction');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Transaction build failed');
    }

    // Build XDR using Stellar SDK (this also calculates proper fees)
    const xdrResult = await buildTransactionXDR(result.transaction);
    
    // Calculate proper fees based on XLM equivalent
    const properFees = await window.Utils.calculateProperFees(result.transaction);
    
    // Store transaction data for signing
    window.currentTransactionData = {
      xdr: xdrResult,
      transaction: result.transaction,
      fees: properFees
    };

    // Show transaction details for confirmation
    window.UIManager.showTransactionConfirmation(result.transaction, properFees);

  } catch (error) {
    console.error('Transaction build failed:', error);
    alert(`Transaction failed: ${error.message}`);

    // Reset button
    const sendButton = document.querySelector('.btn-primary');
    sendButton.textContent = '🚀 Send Payment';
    sendButton.disabled = false;
  }
}

async function signAndSubmitTransaction() {
  try {
    // Show password prompt
    const password = prompt('Enter your password to sign this transaction:');
    if (!password) {
      alert('Password required to sign transaction');
      return;
    }

    // Show loading state
    const confirmButton = document.querySelector('.btn-primary');
    const originalText = confirmButton.textContent;
    confirmButton.textContent = '⏳ Signing Transaction...';
    confirmButton.disabled = true;

    // Get the transaction data from the confirmation screen
    const transactionData = window.currentTransactionData;
    if (!transactionData) {
      throw new Error('No transaction data found');
    }

    console.log('🔍 Transaction data for signing:', transactionData);
    console.log('🔍 XDR to sign:', transactionData.xdr);

    // Sign and submit the transaction using the client-side manager (handles everything)
    const result = await signTransactionWithPassword(transactionData.xdr, password);

    if (!result.success) {
      throw new Error(result.error || 'Transaction failed');
    }

    // Show success message (result already contains the hash)
    window.UIManager.showTransactionSuccess(result.hash);

  } catch (error) {
    console.error('Transaction signing failed:', error);
    alert(`Signing failed: ${error.message}`);

    // Reset button
    const confirmButton = document.querySelector('.btn-primary');
    confirmButton.textContent = '✅ Confirm & Sign';
    confirmButton.disabled = false;
  }
}

// High-security signing for withdrawals (requires password) - FULLY CLIENT-SIDE
async function signTransactionWithPassword(xdr, password) {
  try {
    // Import the encryption utilities
    if (typeof EncryptionUtils === 'undefined') {
      throw new Error('Encryption utilities not loaded');
    }

    // Retrieve and decrypt API keys from Telegram Cloud Storage
    const apiKeys = await EncryptionUtils.retrieveTelegramKey(password);
    if (!apiKeys) {
      throw new Error('No Telegram Cloud Storage key found');
    }

    console.log('✅ Retrieved API keys for high-security signing');

    // Get Telegram ID for logging
    const telegramId = await getTelegramId();
    console.log('🔍 Using Telegram ID for logging:', telegramId);

    // Use the new client-side transaction manager for complete flow
    const transactionManager = createClientSideTransactionManager();
    
    console.log('🚀 Starting complete client-side transaction flow...');
    
    // This will handle everything: session creation, stamping, Turnkey API, signing, and submission
    const result = await transactionManager.signAndSubmitTransaction(
      xdr, 
      telegramId,
      password
    );
    
    console.log('✅ Complete client-side transaction successful:', result);
    
    return {
      success: true,
      signed_xdr: result.signed_xdr,
      hash: result.hash,
      source: 'client-complete'
    };

  } catch (error) {
    console.error('High-security signing failed:', error);
    return { success: false, error: error.message };
  }
}

// Session-based signing for automated operations (no password required)
async function signTransactionWithSession(xdr, operationType = 'swap') {
  try {
    console.log('🤖 Starting session-based signing for:', operationType);

    // Create session transaction stamper (no keys needed)
    const stamper = createSessionTransactionStamper();

    // Sign using session keys via Python bot
    const stampResult = await stamper.stamp(xdr, operationType);
    
    console.log('✅ Session-based signing successful');
    console.log('🔍 Stamp result:', stampResult);
    console.log('🔍 Security level:', stampResult.securityLevel);
    
    return {
      success: true,
      signed_xdr: stampResult.signedXdr,
      source: 'python-bot',
      securityLevel: 'low',
      operationType: operationType
    };

  } catch (error) {
    console.error('Session-based signing failed:', error);
    return { success: false, error: error.message };
  }
}

async function getTelegramId() {
  try {
    console.log('🔍 Getting Telegram ID from authenticator...');
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();
    console.log('🔍 Authenticator response:', authData);
    
    const telegramId = authData.authenticator_info?.user?.telegram_id;
    console.log('🔍 Extracted Telegram ID:', telegramId);
    
    if (!telegramId) {
      console.error('❌ No telegram_id found in authenticator response');
      // Fallback: try to get from Telegram WebApp
      const webAppUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (webAppUser?.id) {
        console.log('🔍 Using fallback Telegram ID from WebApp:', webAppUser.id);
        return webAppUser.id;
      }
    }
    
    return telegramId;
  } catch (error) {
    console.error('Failed to get Telegram ID:', error);
    // Fallback: try to get from Telegram WebApp
    const webAppUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (webAppUser?.id) {
      console.log('🔍 Using fallback Telegram ID from WebApp:', webAppUser.id);
      return webAppUser.id;
    }
    return null;
  }
}

async function submitTransactionToNetwork(signedXdr) {
  try {
    // Submit to Stellar network via Horizon
    const response = await fetch('https://horizon.stellar.org/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `tx=${encodeURIComponent(signedXdr)}`
    });

    const result = await response.json();

    if (response.ok) {
      // Log successful transaction to backend
      await logTransactionToBackend(result.hash);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger
      };
    } else {
      return {
        success: false,
        error: result.extras?.result_codes?.operations?.join(', ') || result.detail || 'Transaction failed'
      };
    }

  } catch (error) {
    console.error('Network submission failed:', error);
    return { success: false, error: error.message };
  }
}

async function logTransactionToBackend(txHash) {
  try {
    // Get current transaction data
    const transactionData = window.currentTransactionData;
    if (!transactionData) {
      console.warn('No transaction data found for logging');
      return;
    }

    // Get user's telegram_id
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();
    const telegram_id = authData.authenticator_info.user.telegram_id;

    // Log to backend
    const response = await fetch('/mini-app/log-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegram_id: telegram_id,
        xdr: transactionData.xdr,
        amount: transactionData.transaction.amount,
        asset: transactionData.transaction.asset,
        recipient: transactionData.transaction.recipient,
        tx_hash: txHash
      })
    });

    if (response.ok) {
      console.log('✅ Transaction logged to backend');
    } else {
      console.warn('⚠️ Failed to log transaction to backend');
    }

  } catch (error) {
    console.error('❌ Error logging transaction:', error);
  }
}

// Enhanced client-side XDR building with Stellar SDK bundle
async function buildTransactionXDR(transactionData) {
  try {
    console.log('🔍 Building XDR client-side with Stellar SDK bundle...');
    console.log('Transaction data:', transactionData);
    
    // Check if Stellar SDK bundle is available
    if (typeof window.StellarSdk === 'undefined') {
      console.log('⚠️ Stellar SDK bundle not loaded, trying fallback...');
      // Fallback to backend XDR building
      return await buildXDRWithBackend(transactionData);
    }
    
    // Use the enhanced transaction builder
    const transactionBuilder = createStellarTransactionBuilder();
    await transactionBuilder.initialize();
    
    // Get user's public key from the wallet
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();
    const sourcePublicKey = authData.authenticator_info.user.public_key;
    
    console.log('Source public key:', sourcePublicKey);
    
    // Build transaction using the enhanced builder
    const result = await transactionBuilder.buildPaymentTransaction(
      sourcePublicKey,
      transactionData.recipient,
      transactionData.amount,
      transactionData.asset,
      transactionData.memo
    );
    
    console.log('✅ XDR built successfully with Stellar SDK bundle');
    console.log('Transaction source:', result.source);
    return result.xdr;
    
  } catch (error) {
    console.error('❌ Error building XDR:', error);
    throw error;
  }
}

// Fallback: Build XDR using backend
async function buildXDRWithBackend(transactionData) {
  try {
    console.log('🔄 Using backend XDR building as fallback...');
    
    // Get user's public key from the wallet
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();
    const sourcePublicKey = authData.authenticator_info.user.public_key;
    
    // Use backend to build proper XDR with Stellar SDK
    const response = await fetch('/mini-app/build-xdr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourcePublicKey: sourcePublicKey,
        transactionData: transactionData
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend XDR building failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ XDR built by backend fallback:', result.xdr);
    return result.xdr;
    
  } catch (error) {
    console.error('❌ Backend XDR building also failed:', error);
    throw error;
  }
}

// Proper signed XDR construction
async function constructSignedXdr(originalXdr, signature, publicKey) {
  try {
    console.log('🔧 Constructing signed XDR...');
    console.log('Original XDR:', originalXdr);
    console.log('Signature:', signature);
    console.log('Public Key:', publicKey);
    
    // Try backend first (for EC2)
    try {
      const response = await fetch('/mini-app/construct-signed-xdr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalXdr: originalXdr,
          signature: signature,
          publicKey: publicKey
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Signed XDR constructed by backend:', result.signedXdr);
        return result.signedXdr;
      } else {
        throw new Error(`Backend returned ${response.status}`);
      }
    } catch (backendError) {
      console.log('⚠️ Backend XDR construction not available:', backendError.message);
      console.log('🔄 Using client-side fallback...');
      
      // For local testing, we'll try a different approach
      // The signature we got should be valid, but we need to construct it properly
      console.log('⚠️ Client-side XDR construction not yet implemented');
      console.log('📝 Returning original XDR for testing');
      return originalXdr;
    }
    
  } catch (error) {
    console.error('❌ Error constructing signed XDR:', error);
    return originalXdr;
  }
}

function calculateProperFees() {
  // This function is already in Utils module
  return window.Utils.calculateProperFees;
}

function validateTransaction() {
  return function(transaction) {
    // Basic validation
    if (!transaction.recipient || !transaction.amount) {
      return false;
    }
    if (!transaction.recipient.startsWith('G')) {
      return false;
    }
    return true;
  };
}

function formatTransactionData() {
  return function(transaction) {
    return {
      recipient: transaction.recipient,
      amount: transaction.amount,
      asset: transaction.asset,
      memo: transaction.memo || ''
    };
  };
}
