// ui-manager.js - UI management and DOM manipulation
// Handles: Navigation, UI state, DOM updates

window.UIManager = {
  // UI state
  currentView: 'wallet',
  isLoading: false,
  
  // Navigation functions
  showWallet,
  showSendPayment,
  showSwapInterface,
  showSettings,
  showAuth,
  showTransactionConfirmation,
  showTransactionSuccess,
  showSwapSuccess,
  
  // UI utilities
  showLoading,
  hideLoading,
  showError,
  showSuccess,
  updateConnectionStatus,
  
  // DOM helpers
  updateContent,
  createAssetCard,
  formatAddress,
  
  // Navigation helpers
  goBackToWallet,
  goBackToSendPayment,
  showAssetManagement,
  showTransactionHistory,
  
  // Initialization
  init: function() {
    console.log('🎨 UIManager initialized');
    console.log('✅ UIManager module loaded successfully');
    console.log('🎨 Available UI functions:', {
      showWallet: typeof this.showWallet,
      showSendPayment: typeof this.showSendPayment,
      showAuth: typeof this.showAuth,
      showTransactionConfirmation: typeof this.showTransactionConfirmation,
      showTransactionSuccess: typeof this.showTransactionSuccess,
      updateConnectionStatus: typeof this.updateConnectionStatus,
      showLoading: typeof this.showLoading,
      hideLoading: typeof this.hideLoading,
      showError: typeof this.showError,
      showSuccess: typeof this.showSuccess
    });
  }
};

// UI functions migrated from index.html

function showWallet() {
  // Recreate the wallet interface
  document.getElementById('content').innerHTML = `
    <div class="fade-in">
      <!-- Wallet Interface -->
      <div id="wallet-interface">
        <h1>LumenBro Wallet</h1>
        <div class="wallet-balance">
          <div class="balance-card">
            <h3>💰 XLM Balance</h3>
            <div class="balance-amount">Loading...</div>
            <div class="balance-currency">XLM</div>
          </div>
        </div>

        <div class="wallet-assets">
          <h3>🪙 All Assets</h3>
          <div id="assets-list" class="assets-list">
            <div class="loading-assets">Loading assets...</div>
          </div>
        </div>

        <div class="wallet-actions">
          <button onclick="window.UIManager.showSendPayment()" class="btn-primary">💸 Send Payment</button>
          <button onclick="showSwapInterface()" class="btn-success">🔄 Swap Assets</button>
          <button onclick="window.UIManager.showAssetManagement()" class="btn-warning">⚙️ Manage Assets</button>
          <button onclick="window.UIManager.showTransactionHistory()" class="btn-info">📊 History</button>
        </div>

        <div class="wallet-status">
          <div id="connection-status" class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Connecting...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <div class="nav-item active" onclick="window.UIManager.showWallet()">
        <div class="nav-icon">💼</div>
        <div class="nav-label">Wallet</div>
      </div>
      <div class="nav-item" onclick="window.UIManager.showAuth()">
        <div class="nav-icon">⚙️</div>
        <div class="nav-label">Settings</div>
      </div>
    </nav>
  `;

  // Load wallet data
  loadWalletData();
}

function showSendPayment() {
  // Show send payment interface
  document.getElementById('content').innerHTML = `
    <div class="fade-in">
      <h1>💸 Send Payment</h1>

      <div class="send-payment-form">
        <div class="form-group">
          <label for="recipientAddress">Recipient Address</label>
          <input type="text" id="recipientAddress" placeholder="G..." class="form-input">
        </div>

        <div class="form-group">
          <label for="assetSelect">Asset</label>
          <select id="assetSelect" class="form-select">
            <option value="XLM">XLM (Native)</option>
            <!-- Other assets will be populated dynamically -->
          </select>
        </div>

        <div class="form-group">
          <label for="amount">Amount</label>
          <input type="number" id="amount" placeholder="0.0000000" step="0.0000001" class="form-input">
        </div>

        <div class="form-group">
          <label for="memo">Memo (Optional)</label>
          <input type="text" id="memo" placeholder="Payment for..." class="form-input">
        </div>

        <div class="fee-info">
          <p>💰 Fee: <span id="feeAmount">0.00001 XLM</span></p>
          <p>📊 Service Fee: <span id="serviceFee">0.00001 XLM</span></p>
        </div>

        <div class="form-actions">
          <button onclick="window.UIManager.goBackToWallet()" class="btn-secondary">← Back</button>
          <button onclick="buildAndSignTransaction()" class="btn-primary">🚀 Send Payment</button>
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

  // Populate asset select with user's assets (with delay to ensure assets are loaded)
  setTimeout(() => {
    populateAssetSelect();
    console.log('🔍 Populating asset select after delay...');
  }, 500);

  // Add change handler for asset selection to update fee display
  document.getElementById('assetSelect').addEventListener('change', updateFeeDisplay);
}

function showSwapInterface() {
  // TODO: Move from index.html
}

function showSettings() {
  // Alias for showAuth
  showAuth();
}

function showAuth() {
  const walletInterface = document.getElementById('wallet-interface');
  const authInterface = document.getElementById('auth-interface');
  const bottomNav = document.querySelector('.bottom-nav');

  if (walletInterface) walletInterface.style.display = 'none';
  if (authInterface) authInterface.style.display = 'block';
  if (bottomNav) bottomNav.style.display = 'flex';

  // Show the main menu (settings) with all functions
  document.getElementById('content').innerHTML = `
    <div class="fade-in">
      <h1>🔧 Settings</h1>
      <div class="flex flex-col items-center gap-4" style="margin-bottom: 40px;">
        <button onclick="window.register()" class="btn-primary">📝 Register</button>
        <button onclick="window.login()" class="btn-success">🔐 Login</button>      
        <button onclick="window.recover()" class="btn-warning">🔑 Recovery</button> 
        <button onclick="window.export()" class="btn-info">📤 Export Keys</button>  
        <button onclick="testTurnkeyStamper()" class="btn-secondary">🧪 Test Turnkey</button>
        <button onclick="window.UIManager.showWallet()" class="btn-warning">🔧 Force Show Wallet</button>  
      </div>

      <!-- Quick access to wallet (if authenticated) -->
      <div id="quick-wallet-access" style="display: none; margin-top: 20px;">
        <button onclick="window.UIManager.showWallet()" class="btn-info">💼 Open Wallet</button>     
      </div>
    </div>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <div class="nav-item" onclick="window.UIManager.showWallet()">
        <div class="nav-icon">💼</div>
        <div class="nav-label">Wallet</div>
      </div>
      <div class="nav-item active" onclick="window.UIManager.showAuth()">
        <div class="nav-icon">⚙️</div>
        <div class="nav-label">Settings</div>
      </div>
    </nav>
  `;
}

function showTransactionConfirmation(transaction, fees) {
  const isXLM = transaction.asset === 'XLM';
  const assetCode = typeof transaction.asset === 'string' ? transaction.asset : transaction.asset.code;
  
  // Format recipient address for better display
  const recipient = transaction.recipient;
  const formattedRecipient = recipient.length > 20 ? 
    recipient.substring(0, 20) + '\n' + recipient.substring(20, 40) + '\n' + recipient.substring(40) : 
    recipient;
  
  document.getElementById('content').innerHTML = `
    <div class="fade-in">
      <h1>🔍 Confirm Transaction</h1>

      <div class="transaction-details">
        <div class="detail-row">
          <span class="label">Recipient:</span>
          <span class="value">${formattedRecipient}</span>
        </div>
        <div class="detail-row">
          <span class="label">Amount:</span>
          <span class="value">${transaction.amount} ${assetCode}</span>   
        </div>
        <div class="detail-row">
          <span class="label">Network Fee:</span>
          <span class="value">${fees.networkFee} XLM</span>
        </div>
        <div class="detail-row">
          <span class="label">Service Fee:</span>
          <span class="value">${fees.serviceFee} XLM</span>
        </div>
        <div class="detail-row total">
          <span class="label">Total:</span>
          <span class="value">${isXLM ? `${fees.total} XLM` : `${fees.total} XLM (fees only)`}</span>
        </div>
        ${!isXLM ? `<div class="detail-row note">
          <span class="label">Note:</span>
          <span class="value">Sending ${transaction.amount} ${assetCode} + ${fees.total} XLM in fees</span>
        </div>` : ''}
      </div>

      <div class="form-actions" style="margin-bottom: 100px;">
        <button onclick="window.UIManager.goBackToSendPayment()" class="btn-secondary">← Back</button>
        <button onclick="signAndSubmitTransaction()" class="btn-primary">✅ Confirm & Sign</button>
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
}

function showSwapSuccess(transaction, fees) {
  // TODO: Move from index.html
}

function showTransactionSuccess(hash) {
  document.getElementById('content').innerHTML = `
    <div class="fade-in">
      <div class="success-message">
        <div class="success-icon">✅</div>
        <h1>Transaction Successful!</h1>
        <p>Your payment has been sent successfully.</p>
        <div class="transaction-hash">
          <strong>Transaction Hash:</strong><br>
          <code style="word-break: break-all; font-size: 0.9em; line-height: 1.4; max-width: 100%; overflow-wrap: break-word;">${hash}</code>
        </div>
        <div class="form-actions" style="margin-top: 20px;">
          <button onclick="window.UIManager.showWallet()" class="btn-primary">🏠 Back to Wallet</button>
          <button onclick="window.open('https://stellar.expert/explorer/public/tx/${hash}', '_blank')" class="btn-secondary">🔍 View on Explorer</button>
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
}

function showLoading(message = 'Loading...') {
  // TODO: Implement loading overlay
  console.log('🔄 Showing loading:', message);
}

function hideLoading() {
  // TODO: Implement loading overlay
  console.log('✅ Hiding loading...');
}

function showError(message) {
  // TODO: Move from index.html
  alert('Error: ' + message);
}

function showSuccess(message) {
  // TODO: Move from index.html
  alert('Success: ' + message);
}

function updateContent(html) {
  // TODO: Move from index.html
  document.getElementById('content').innerHTML = html;
}

function createAssetCard(asset, balance) {
  // TODO: Move from index.html
}

function formatAddress(address) {
  // TODO: Move from index.html
  if (!address || address.length < 10) return address;
  return address.substring(0, 10) + '...' + address.substring(address.length - 10);
}

function updateConnectionStatus(text, status) {
  const statusElement = document.getElementById('connection-status');
  if (!statusElement) return;

  const statusDot = statusElement.querySelector('.status-dot');
  const statusText = statusElement.querySelector('.status-text');

  if (statusText) statusText.textContent = text;
  if (statusDot) statusDot.className = `status-dot ${status}`;
}

// Navigation helper functions
function goBackToWallet() {
  showWallet();
}

function goBackToSendPayment() {
  showSendPayment();
}

function showAssetManagement() {
  // TODO: Implement asset management interface
  alert('Asset Management feature coming soon!');
}

function showTransactionHistory() {
  // TODO: Implement transaction history interface
  alert('Transaction History feature coming soon!');
}
