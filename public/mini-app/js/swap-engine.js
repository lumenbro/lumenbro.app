// swap-engine.js - Swap functionality
// Handles: Swap interface, quote fetching, swap execution

window.SwapEngine = {
  // Swap state
  selectedSwapMode: null,
  currentQuote: null,
  
  // Core functions
  showSwapInterface,
  selectSwapMode,
  toggleSwapMode,
  executeSwap,
  updateSwapEstimate,
  checkSwapSessionStatus,
  simulateAndExecuteSwap,
  
  // Quote management
  fetchSwapQuote,
  buildSwapTransaction,
  
  // Initialization
  init: function() {
    console.log('🔄 SwapEngine initialized');
    console.log('✅ SwapEngine module loaded successfully');
    console.log('🔄 Available swap functions:', {
      showSwapInterface: typeof this.showSwapInterface,
      selectSwapMode: typeof this.selectSwapMode,
      executeSwap: typeof this.executeSwap,
      updateSwapEstimate: typeof this.updateSwapEstimate,
      checkSwapSessionStatus: typeof this.checkSwapSessionStatus,
      simulateAndExecuteSwap: typeof this.simulateAndExecuteSwap,
      fetchSwapQuote: typeof this.fetchSwapQuote,
      buildSwapTransaction: typeof this.buildSwapTransaction
    });
  }
};

// Swap functions migrated from index.html

async function checkSwapSessionStatus() {
  try {
    const response = await fetch('/mini-app/authenticator');
    const data = await response.json();
    
    console.log('🔍 Swap session check response:', data);
    
    // Handle the proxy response structure from Node.js to Python bot
    if (data.success && data.authenticator_info?.authenticator?.has_active_session) {
      console.log('✅ Active database session detected:', {
        type: data.authenticator_info.authenticator.type,
        signingMethod: data.authenticator_info.authenticator.signing_method,
        hasActiveSession: data.authenticator_info.authenticator.has_active_session
      });
      return {
        hasActiveSession: true,
        sessionType: data.authenticator_info.authenticator.type,
        signingMethod: data.authenticator_info.authenticator.signing_method
      };
    } else {
      console.log('❌ No active database session:', {
        success: data.success,
        hasActiveSession: data.authenticator_info?.authenticator?.has_active_session,
        type: data.authenticator_info?.authenticator?.type,
        signingMethod: data.authenticator_info?.authenticator?.signing_method,
        fullResponse: data
      });
      return {
        hasActiveSession: false,
        sessionType: null,
        signingMethod: null
      };
    }
  } catch (error) {
    console.error('Error checking swap session status:', error);
    return {
      hasActiveSession: false,
      sessionType: null,
      signingMethod: null
    };
  }
}

async function showSwapInterface() {
  const sessionStatus = await checkSwapSessionStatus();
  
  document.getElementById('content').innerHTML = `
    <div class="fade-in">
      <h1>🔄 Swap Assets</h1>
      
      <div class="swap-mode-selection">
        <h3>Choose Swap Mode:</h3>
        <div class="swap-mode-options">
          ${sessionStatus.hasActiveSession ? `
            <div class="swap-mode-option active" onclick="window.SwapEngine.selectSwapMode('instant')">
              <div class="mode-icon">⚡</div>
              <div class="mode-info">
                <div class="mode-title">Instant Swap</div>
                <div class="mode-description">Use your active session (${sessionStatus.sessionType})</div>
              </div>
              <div class="mode-status">✅ Available</div>
            </div>
          ` : `
            <div class="swap-mode-option disabled">
              <div class="mode-icon">⚡</div>
              <div class="mode-info">
                <div class="mode-title">Instant Swap</div>
                <div class="mode-description">Requires active session</div>
              </div>
              <div class="mode-status">❌ Not Available</div>
            </div>
          `}
          
          <div class="swap-mode-option ${!sessionStatus.hasActiveSession ? 'active' : ''}" onclick="window.SwapEngine.selectSwapMode('password')">
            <div class="mode-icon">🔐</div>
            <div class="mode-info">
              <div class="mode-title">Password Swap</div>
              <div class="mode-description">Sign each swap with password</div>
            </div>
            <div class="mode-status">✅ Always Available</div>
          </div>
        </div>
      </div>

      <div class="swap-form" style="display: none;">
        <div class="swap-mode-toggle">
          <h4>Swap Mode:</h4>
          <div class="toggle-buttons">
            <button id="ppssToggle" class="toggle-btn active" onclick="window.SwapEngine.toggleSwapMode('ppss')">
              <span class="toggle-icon">📤</span>
              <span class="toggle-label">Strict Send</span>
              <span class="toggle-desc">Fixed amount sent</span>
            </button>
            <button id="ppsrToggle" class="toggle-btn" onclick="window.SwapEngine.toggleSwapMode('ppsr')">
              <span class="toggle-icon">📥</span>
              <span class="toggle-label">Strict Receive</span>
              <span class="toggle-desc">Fixed amount received</span>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="sendAssetSelect">Send Asset:</label>
          <select id="sendAssetSelect" class="form-select" onchange="window.SwapEngine.updateSwapEstimate()">
            <option value="XLM">XLM (Native)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="sendAmount">Send Amount:</label>
          <input type="number" id="sendAmount" class="form-control" placeholder="0.0000000" step="0.0000001" onchange="window.SwapEngine.updateSwapEstimate()">
        </div>
        
        <div class="swap-direction">
          <div class="swap-arrow">↓</div>
        </div>
        
        <div class="form-group">
          <label for="receiveAssetSelect">Receive Asset:</label>
          <select id="receiveAssetSelect" class="form-select" onchange="window.SwapEngine.updateSwapEstimate()">
            <option value="XLM">XLM (Native)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="receiveAmount">Receive Amount (Estimate):</label>
          <input type="number" id="receiveAmount" class="form-control" placeholder="0.0000000" step="0.0000001" readonly>
        </div>

        <div class="swap-rate-display">
          <div class="rate-info">
            <span class="rate-label">Exchange Rate:</span>
            <span class="rate-value" id="swapRate">Select assets to see rate</span>
          </div>
          <div class="rate-update">
            <button onclick="window.SwapEngine.updateSwapEstimate()" class="refresh-btn">🔄 Refresh</button>
          </div>
        </div>
        
        <div class="swap-details">
          <div class="detail-row">
            <span class="label">Network Fee:</span>
            <span class="value" id="swapNetworkFee">0.00001 XLM</span>
          </div>
          <div class="detail-row">
            <span class="label">Service Fee:</span>
            <span class="value" id="swapServiceFee">0.00001 XLM</span>
          </div>
          <div class="detail-row">
            <span class="label">Slippage:</span>
            <span class="value" id="swapSlippage">0.5%</span>
          </div>
          <div class="detail-row">
            <span class="label">Price Impact:</span>
            <span class="value" id="swapPriceImpact">0.0%</span>
          </div>
        </div>
        
        <div class="form-actions">
          <button onclick="window.UIManager.goBackToWallet()" class="btn-secondary">← Back</button>
          <button onclick="window.SwapEngine.executeSwap()" class="btn-primary">🔄 Execute Swap</button>
        </div>
      </div>
    </div>

    <nav class="bottom-nav">
      <div class="nav-item" onclick="window.UIManager.showWallet()">
        <div class="nav-icon">💼</div>
        <div class="nav-label">Wallet</div>
      </div>
      <div class="nav-item" onclick="window.UIManager.showAuth()">
        <div class="nav-icon">⚙️</div>
        <div class="nav-label">Settings</div>
      </div>
    </nav>
  `;
  
  // Populate asset selects
  await window.WalletCore.populateSwapAssetSelects();
}

function selectSwapMode(mode) {
  const swapForm = document.querySelector('.swap-form');
  const modeOptions = document.querySelectorAll('.swap-mode-option');
  
  // Update active states
  modeOptions.forEach(option => {
    option.classList.remove('active');
  });
  
  // Find and activate the selected mode
  const selectedOption = Array.from(modeOptions).find(option => 
    option.querySelector('.mode-title').textContent.toLowerCase().includes(mode)
  );
  if (selectedOption && !selectedOption.classList.contains('disabled')) {
    selectedOption.classList.add('active');
  }
  
  // Show swap form
  swapForm.style.display = 'block';
  
  // Store the selected mode
  window.selectedSwapMode = mode;
  
  console.log(`Selected swap mode: ${mode}`);
}

function toggleSwapMode(mode) {
  const ppssToggle = document.getElementById('ppssToggle');
  const ppsrToggle = document.getElementById('ppsrToggle');
  const sendAmountLabel = document.querySelector('label[for="sendAmount"]');
  const receiveAmountLabel = document.querySelector('label[for="receiveAmount"]');
  
  // Update toggle button states
  if (mode === 'ppss') {
    ppssToggle.classList.add('active');
    ppsrToggle.classList.remove('active');
    sendAmountLabel.textContent = 'Send Amount (Fixed):';
    receiveAmountLabel.textContent = 'Receive Amount (Estimate):';
    document.getElementById('sendAmount').readOnly = false;
    document.getElementById('receiveAmount').readOnly = true;
  } else {
    ppssToggle.classList.remove('active');
    ppsrToggle.classList.add('active');
    sendAmountLabel.textContent = 'Send Amount (Estimate):';
    receiveAmountLabel.textContent = 'Receive Amount (Fixed):';
    document.getElementById('sendAmount').readOnly = true;
    document.getElementById('receiveAmount').readOnly = false;
  }
  
  // Store the swap mode
  window.currentSwapMode = mode;
  
  // Update the estimate
  updateSwapEstimate();
  
  console.log(`Swap mode toggled to: ${mode}`);
}

async function executeSwap() {
  const sendAssetSelect = document.getElementById('sendAssetSelect');
  const receiveAssetSelect = document.getElementById('receiveAssetSelect');
  const sendAmount = document.getElementById('sendAmount').value;
  
  if (!sendAmount || parseFloat(sendAmount) <= 0) {
    alert('Please enter a valid send amount');
    return;
  }
  
  // Parse asset information
  let sendAsset, receiveAsset;
  if (sendAssetSelect.value === 'XLM') {
    sendAsset = 'XLM';
  } else {
    try {
      sendAsset = JSON.parse(sendAssetSelect.value);
    } catch (error) {
      alert('Invalid send asset selection');
      return;
    }
  }
  
  if (receiveAssetSelect.value === 'XLM') {
    receiveAsset = 'XLM';
  } else {
    try {
      receiveAsset = JSON.parse(receiveAssetSelect.value);
    } catch (error) {
      alert('Invalid receive asset selection');
      return;
    }
  }
  
  if (sendAsset === receiveAsset) {
    alert('Send and receive assets must be different');
    return;
  }
  
  console.log('🔄 Starting swap execution...');
  console.log('Send Asset:', sendAsset);
  console.log('Receive Asset:', receiveAsset);
  console.log('Send Amount:', sendAmount);
  console.log('Swap Mode:', window.selectedSwapMode);
  
  // TODO: Phase 2 - Implement quote fetching
  // TODO: Phase 3 - Implement transaction building
  // TODO: Phase 4 - Implement execution
  
  alert('Swap functionality coming soon! This will be implemented in the next phase.');
}

async function updateSwapEstimate() {
  const sendAssetValue = document.getElementById('sendAssetSelect')?.value;
  const sendAmount = parseFloat(document.getElementById('sendAmount')?.value || 0);
  const receiveAmount = parseFloat(document.getElementById('receiveAmount')?.value || 0);
  const receiveAssetValue = document.getElementById('receiveAssetSelect')?.value;
  const swapMode = window.currentSwapMode || 'ppss';

  // Validate inputs based on swap mode
  if (!sendAssetValue || !receiveAssetValue || sendAssetValue === receiveAssetValue) {
    document.getElementById('swapRate').textContent = 'Select different assets';
    return;
  }

  if (swapMode === 'ppss' && (!sendAmount || sendAmount <= 0)) {
    document.getElementById('swapRate').textContent = 'Enter send amount';
    document.getElementById('receiveAmount').value = '';
    return;
  }

  if (swapMode === 'ppsr' && (!receiveAmount || receiveAmount <= 0)) {
    document.getElementById('swapRate').textContent = 'Enter receive amount';
    document.getElementById('sendAmount').value = '';
    return;
  }

  // Parse asset information
  let sendAsset, receiveAsset;
  try {
    sendAsset = sendAssetValue === 'XLM' ? 'XLM' : JSON.parse(sendAssetValue);
    receiveAsset = receiveAssetValue === 'XLM' ? 'XLM' : JSON.parse(receiveAssetValue);
  } catch (error) {
    console.error('Failed to parse asset info:', error);
    document.getElementById('swapRate').textContent = 'Invalid asset selection';
    return;
  }

  try {
    // Get user's public key
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();
    const sourcePublicKey = authData.authenticator_info.user.public_key;

    // Prepare simulation parameters based on swap mode
    let simulationParams = {
      sourcePublicKey: sourcePublicKey,
      sendAsset: sendAsset,
      destination: sourcePublicKey, // Swap to self
      destAsset: receiveAsset,
      path: [],
      telegram_id: authData.authenticator_info.user.telegram_id
    };

    if (swapMode === 'ppss') {
      // Path Payment Strict Send - fixed send amount
      simulationParams.sendAmount = sendAmount.toString();
      simulationParams.destMin = '0.0000001';
    } else {
      // Path Payment Strict Receive - fixed receive amount
      simulationParams.sendMax = '999999999.0000000'; // High max to allow calculation
      simulationParams.destAmount = receiveAmount.toString();
    }

    // Simulate path payment
    const simulationResponse = await fetch('/mini-app/simulate-path-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simulationParams)
    });

    if (simulationResponse.ok) {
      const result = await simulationResponse.json();
      
      if (result.simulation.success) {
        const sendAssetCode = typeof sendAsset === 'string' ? sendAsset : sendAsset.code;
        const receiveAssetCode = typeof receiveAsset === 'string' ? receiveAsset : receiveAsset.code;
        
        let rate, actualSend, actualReceive;
        
        if (swapMode === 'ppss') {
          // Strict Send - we know send amount, calculate receive
          actualSend = sendAmount;
          actualReceive = parseFloat(result.simulation.minReceived);
          rate = actualReceive / actualSend;
          document.getElementById('receiveAmount').value = actualReceive.toFixed(7);
        } else {
          // Strict Receive - we know receive amount, calculate send
          actualReceive = receiveAmount;
          actualSend = parseFloat(result.simulation.sendAmount || sendAmount);
          rate = actualReceive / actualSend;
          document.getElementById('sendAmount').value = actualSend.toFixed(7);
        }
        
        // Calculate price impact (simplified)
        const priceImpact = Math.abs((rate - 1) * 100).toFixed(2);
        
        document.getElementById('swapRate').textContent = `1 ${sendAssetCode} = ${rate.toFixed(6)} ${receiveAssetCode}`;
        document.getElementById('swapNetworkFee').textContent = `${result.fees.networkFee} XLM`;
        document.getElementById('swapServiceFee').textContent = `${result.fees.serviceFee} XLM`;
        document.getElementById('swapPriceImpact').textContent = `${priceImpact}%`;
        
        console.log(`✅ Swap quote calculated: ${actualSend} ${sendAssetCode} → ${actualReceive} ${receiveAssetCode} (Rate: ${rate.toFixed(6)})`);
      } else {
        document.getElementById('swapRate').textContent = 'No path found';
        if (swapMode === 'ppss') {
          document.getElementById('receiveAmount').value = '';
        } else {
          document.getElementById('sendAmount').value = '';
        }
      }
    } else {
      document.getElementById('swapRate').textContent = 'Simulation failed';
      document.getElementById('receiveAmount').value = '';
    }
  } catch (error) {
    console.error('Swap estimation failed:', error);
    document.getElementById('swapRate').textContent = 'Error calculating';
    document.getElementById('receiveAmount').value = '';
  }
}

async function simulateAndExecuteSwap() {
  const sendAsset = document.getElementById('sendAssetSelect')?.value;
  const sendAmount = parseFloat(document.getElementById('sendAmount')?.value || 0);
  const receiveAsset = document.getElementById('receiveAssetSelect')?.value;
  const receiveAmount = parseFloat(document.getElementById('receiveAmount')?.value || 0);

  if (!sendAsset || !sendAmount || !receiveAsset || !receiveAmount || sendAsset === receiveAsset) {
    alert('Please fill in all swap details');
    return;
  }

  try {
    // Show loading state
    const swapButton = document.querySelector('.btn-primary');
    const originalText = swapButton.textContent;
    swapButton.textContent = '⏳ Simulating Swap...';
    swapButton.disabled = true;

    // Get user's public key
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();
    const sourcePublicKey = authData.authenticator_info.user.public_key;

    // Build path payment transaction
    const transactionBuilder = createStellarTransactionBuilder();
    await transactionBuilder.initialize();

    const transactionResult = await transactionBuilder.buildPathPaymentTransaction(
      sourcePublicKey,
      sendAsset === 'XLM' ? 'XLM' : { code: sendAsset, issuer: 'ISSUER' },
      sendAmount,
      sourcePublicKey, // Swap to self
      receiveAsset === 'XLM' ? 'XLM' : { code: receiveAsset, issuer: 'ISSUER' },
      receiveAmount,
      []
    );

    // Store transaction data for signing
    window.currentSwapData = {
      xdr: transactionResult.xdr,
      sendAsset: sendAsset,
      sendAmount: sendAmount,
      receiveAsset: receiveAsset,
      receiveAmount: receiveAmount,
      source: transactionResult.source
    };

    // TODO: Implement signing and execution based on swap mode
    console.log('Swap transaction built:', window.currentSwapData);

  } catch (error) {
    console.error('Swap execution failed:', error);
    alert(`Swap failed: ${error.message}`);
  } finally {
    // Reset button
    const swapButton = document.querySelector('.btn-primary');
    swapButton.textContent = '🔄 Execute Swap';
    swapButton.disabled = false;
  }
}

async function fetchSwapQuote(sendAsset, receiveAsset, amount) {
  // TODO: Implement swap quote fetching from DEX or aggregator
  try {
    // This would fetch a quote from a DEX or aggregator
    console.log('Fetching swap quote...');
    return {
      success: true,
      quote: {
        sendAsset,
        sendAmount: amount,
        receiveAsset,
        receiveAmount: amount * 1.0, // Placeholder
        rate: 1.0,
        fees: {
          network: 0.00001,
          service: 0.00001
        }
      }
    };
  } catch (error) {
    console.error('Failed to fetch swap quote:', error);
    return { success: false, error: error.message };
  }
}

async function buildSwapTransaction(quote) {
  // TODO: Implement swap transaction building
  try {
    console.log('Building swap transaction...');
    // This would build a path payment transaction
    return {
      success: true,
      transaction: {
        xdr: 'placeholder',
        source: 'placeholder',
        operations: []
      }
    };
  } catch (error) {
    console.error('Failed to build swap transaction:', error);
    return { success: false, error: error.message };
  }
}
