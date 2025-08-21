// wallet-core.js - Core wallet functionality
// Handles: Balance loading, asset display, wallet state management

window.WalletCore = {
  // Wallet state
  walletAssets: [],
  currentAccount: null,
  
  // Core functions
  loadWalletData,
  displayAllAssets,
  populateAssetSelect,
  populateSwapAssetSelects,
  getXlmEquivalent,
  
  // Asset management
  getAssetMetadata,
  formatAssetBalance,
  fetchAssetMetadata,
  fetchAssetFromToml,
  
  // Initialization
  init: function() {
    console.log('🔧 WalletCore initialized');
    console.log('✅ WalletCore module loaded successfully');
    console.log('🔧 Available wallet functions:', {
      loadWalletData: typeof this.loadWalletData,
      displayAllAssets: typeof this.displayAllAssets,
      populateAssetSelect: typeof this.populateAssetSelect,
      populateSwapAssetSelects: typeof this.populateSwapAssetSelects,
      getXlmEquivalent: typeof this.getXlmEquivalent,
      getAssetMetadata: typeof this.getAssetMetadata,
      formatAssetBalance: typeof this.formatAssetBalance,
      fetchAssetMetadata: typeof this.fetchAssetMetadata,
      fetchAssetFromToml: typeof this.fetchAssetFromToml
    });
  }
};

// Core wallet functions migrated from index.html

async function loadWalletData() {
  try {
    // Update connection status
    window.UIManager.updateConnectionStatus('Loading balance...', 'connecting');

    // Get user's public key from authenticator endpoint
    const authResponse = await fetch('/mini-app/authenticator');
    const authData = await authResponse.json();

    if (!authData.success) {
      throw new Error('Failed to get user data');
    }

    const publicKey = authData.authenticator_info.user.public_key;
    console.log('Loading balance for public key:', publicKey);

    // Use Stellar-Plus to get real balance
    // For now, we'll use a simple fetch to Stellar RPC
    // Later we can add the full Stellar-Plus library
    const stellarResponse = await fetch(`https://horizon.stellar.org/accounts/${publicKey}`);
    const accountData = await stellarResponse.json();

    if (accountData.detail) {
      throw new Error('Account not found on Stellar network');
    }

    // Find XLM balance
    const xlmBalance = accountData.balances.find(balance =>
      balance.asset_type === 'native'
    );

    const balanceAmount = document.querySelector('.balance-amount');
    if (balanceAmount && xlmBalance) {
      balanceAmount.textContent = parseFloat(xlmBalance.balance).toFixed(2);
    }

    // Display all assets
    await displayAllAssets(accountData.balances);

    // Show total assets count
    const totalAssets = accountData.balances.length;
    console.log(`Account has ${totalAssets} assets (including XLM)`);

    // Asset selects will be populated after assets are displayed

    window.UIManager.updateConnectionStatus('Connected', 'connected');

  } catch (error) {
    console.error('Error loading wallet data:', error);
    window.UIManager.updateConnectionStatus('Connection failed', 'error');

    // Show error in balance
    const balanceAmount = document.querySelector('.balance-amount');
    if (balanceAmount) {
      balanceAmount.textContent = 'Error';
    }
  }
}

async function displayAllAssets(balances) {
  const assetsList = document.getElementById('assets-list');
  if (!assetsList) {
    console.log('❌ Assets list element not found');
    return;
  }

  console.log('🔍 Displaying assets:', balances);

  // Clear loading message
  assetsList.innerHTML = '';

  // Process each balance and fetch asset metadata
  for (const balance of balances) {
    console.log('🔍 Processing balance:', balance);
    const assetCard = document.createElement('div');
    assetCard.className = 'asset-card';

    let assetName, assetCode, assetIcon, assetIssuer;

    if (balance.asset_type === 'native') {
      // XLM
      assetName = 'Stellar Lumens';
      assetCode = 'XLM';
      assetIcon = '/media/stellar-logo.svg';
      assetIssuer = null;
    } else if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
      // Traditional assets
      assetName = balance.asset_code || 'Unknown Asset';
      assetCode = balance.asset_code;
      assetIcon = '🪙'; // Default fallback
      assetIssuer = balance.asset_issuer;
    } else {
      // Soroban or other assets
      assetName = 'Smart Contract Asset';
      assetCode = 'SOROBAN';
      assetIcon = '🤖';
      assetIssuer = null;
    }

    // Create initial card with fallback icon
    const balanceAmount = parseFloat(balance.balance).toFixed(7);

    // Add issuer data attribute for non-native assets
    if (assetIssuer) {
      assetCard.dataset.issuer = assetIssuer;
    }

    assetCard.innerHTML = `
      <div class="asset-info">
        <div class="asset-icon">
          <img alt="${assetCode}" class="asset-icon-img" style="display: ${balance.asset_type === 'native' ? 'block' : 'none'};" src="${balance.asset_type === 'native' ? assetIcon : ''}">
          <span class="asset-icon-fallback" style="display: ${balance.asset_type === 'native' ? 'none' : 'inline'}">${balance.asset_type === 'native' ? '' : assetIcon}</span>        
        </div>
        <div class="asset-details">
          <div class="asset-name">${assetName}</div>
          <div class="asset-code">${assetCode}</div>
        </div>
      </div>
      <div class="asset-balance">
        <div class="balance-amount">${balanceAmount}</div>
        <div class="balance-limit">${balance.limit ? `Limit: ${balance.limit}` : ''}</div>
      </div>
    `;

    assetsList.appendChild(assetCard);
    console.log(`✅ Added asset card for ${assetCode}:`, assetCard);

    // Fetch real asset metadata if not XLM
    if (balance.asset_type !== 'native' && assetIssuer) {
      try {
        await fetchAssetMetadata(assetCode, assetIssuer, assetCard);
      } catch (error) {
        console.log(`Failed to fetch metadata for ${assetCode}:`, error);
        // Keep fallback icon
      }
    }
  }

  // If no assets found
  if (balances.length === 0) {
    assetsList.innerHTML = '<div class="no-assets">No assets found</div>';
  }

  console.log(`✅ Finished displaying ${balances.length} assets`);
  console.log(`🔍 Total asset cards in DOM: ${document.querySelectorAll('.asset-card').length}`);
  
  // Store asset data globally for use in dropdowns
  window.walletAssets = balances.map(balance => {
    let assetName, assetCode, assetIssuer;
    
    if (balance.asset_type === 'native') {
      assetName = 'Stellar Lumens';
      assetCode = 'XLM';
      assetIssuer = null;
    } else if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
      assetName = balance.asset_code || 'Unknown Asset';
      assetCode = balance.asset_code;
      assetIssuer = balance.asset_issuer;
    } else {
      assetName = 'Smart Contract Asset';
      assetCode = 'SOROBAN';
      assetIssuer = null;
    }
    
    return {
      code: assetCode,
      name: assetName,
      issuer: assetIssuer,
      balance: balance.balance,
      asset_type: balance.asset_type
    };
  });
  
  console.log('💾 Stored wallet assets globally:', window.walletAssets);
  
  // Now that assets are displayed, populate any existing asset selects
  populateAssetSelect();
  populateSwapAssetSelects();
}

function populateAssetSelect() {
  const assetSelect = document.getElementById('assetSelect');
  if (!assetSelect) {
    console.log('❌ Asset select element not found');
    return;
  }

  console.log('🔍 Populating asset select...');

  // Clear existing options except XLM
  assetSelect.innerHTML = '<option value="XLM">XLM (Native)</option>';

  // Use global wallet assets if available
  if (window.walletAssets && window.walletAssets.length > 0) {
    console.log('💾 Using global wallet assets:', window.walletAssets);
    
    window.walletAssets.forEach(asset => {
      if (asset.code !== 'XLM') {
        const option = document.createElement('option');
        const assetInfo = {
          code: asset.code,
          issuer: asset.issuer,
          name: asset.name
        };
        option.value = JSON.stringify(assetInfo);
        option.textContent = `${asset.code} (${asset.name}) - Balance: ${parseFloat(asset.balance).toFixed(7)}`;
        assetSelect.appendChild(option);
        console.log(`✅ Added asset option from global data: ${asset.code}`);
      }
    });
  } else {
    // Fallback to asset cards if global data not available
    const assetCards = document.querySelectorAll('.asset-card');
    console.log(`🔍 Fallback: Found ${assetCards.length} asset cards`);

    assetCards.forEach((card, index) => {
      const assetName = card.querySelector('.asset-name')?.textContent;
      const assetCode = card.querySelector('.asset-code')?.textContent;
      const balanceAmount = card.querySelector('.balance-amount')?.textContent;

      console.log(`🔍 Asset ${index + 1}:`, { assetName, assetCode, balanceAmount, issuer: card.dataset.issuer });

      if (assetCode && assetCode !== 'XLM') {
        const option = document.createElement('option');
        const assetInfo = {
          code: assetCode,
          issuer: card.dataset.issuer || null,
          name: assetName || 'Unknown'
        };
        option.value = JSON.stringify(assetInfo);
        option.textContent = `${assetCode} (${assetName || 'Unknown'}) - Balance: ${balanceAmount}`;
        assetSelect.appendChild(option);
        console.log(`✅ Added asset option from card: ${assetCode}`);
      }
    });
  }

  console.log(`✅ Asset select populated with ${assetSelect.options.length} options`);
  
  // Debug: Log all options in the select
  console.log('🔍 All options in select:');
  for (let i = 0; i < assetSelect.options.length; i++) {
    console.log(`  Option ${i}:`, {
      value: assetSelect.options[i].value,
      text: assetSelect.options[i].text,
      selected: assetSelect.options[i].selected
    });
  }
}

function populateSwapAssetSelects() {
  const sendAssetSelect = document.getElementById('sendAssetSelect');
  const receiveAssetSelect = document.getElementById('receiveAssetSelect');
  
  if (!sendAssetSelect || !receiveAssetSelect) {
    console.log('❌ Swap asset select elements not found');
    return;
  }

  console.log('🔍 Populating swap asset selects...');

  // Clear existing options except XLM
  sendAssetSelect.innerHTML = '<option value="XLM">XLM (Native)</option>';
  receiveAssetSelect.innerHTML = '<option value="XLM">XLM (Native)</option>';

  // Use global wallet assets if available
  if (window.walletAssets && window.walletAssets.length > 0) {
    console.log('💾 Using global wallet assets for swap:', window.walletAssets);
    
    window.walletAssets.forEach(asset => {
      if (asset.code !== 'XLM') {
        const assetInfo = {
          code: asset.code,
          issuer: asset.issuer,
          name: asset.name
        };

        // Add to send select
        const sendOption = document.createElement('option');
        sendOption.value = JSON.stringify(assetInfo);
        sendOption.textContent = `${asset.code} (${asset.name}) - Balance: ${parseFloat(asset.balance).toFixed(7)}`;
        sendAssetSelect.appendChild(sendOption);

        // Add to receive select
        const receiveOption = document.createElement('option');
        receiveOption.value = JSON.stringify(assetInfo);
        receiveOption.textContent = `${asset.code} (${asset.name})`;
        receiveAssetSelect.appendChild(receiveOption);

        console.log(`✅ Added swap asset options from global data: ${asset.code}`);
      }
    });
  } else {
    // Fallback to asset cards if global data not available
    const assetCards = document.querySelectorAll('.asset-card');
    console.log(`🔍 Fallback: Found ${assetCards.length} asset cards for swap`);

    assetCards.forEach((card, index) => {
      const assetName = card.querySelector('.asset-name')?.textContent;
      const assetCode = card.querySelector('.asset-code')?.textContent;
      const balanceAmount = card.querySelector('.balance-amount')?.textContent;

      console.log(`🔍 Swap Asset ${index + 1}:`, { assetName, assetCode, balanceAmount, issuer: card.dataset.issuer });

      if (assetCode && assetCode !== 'XLM') {
        const assetInfo = {
          code: assetCode,
          issuer: card.dataset.issuer || null,
          name: assetName || 'Unknown'
        };

        // Add to send select
        const sendOption = document.createElement('option');
        sendOption.value = JSON.stringify(assetInfo);
        sendOption.textContent = `${assetCode} (${assetName || 'Unknown'}) - Balance: ${balanceAmount}`;
        sendAssetSelect.appendChild(sendOption);

        // Add to receive select
        const receiveOption = document.createElement('option');
        receiveOption.value = JSON.stringify(assetInfo);
        receiveOption.textContent = `${assetCode} (${assetName || 'Unknown'})`;
        receiveAssetSelect.appendChild(receiveOption);

        console.log(`✅ Added swap asset options from card: ${assetCode}`);
      }
    });
  }

  console.log(`✅ Swap asset selects populated with ${sendAssetSelect.options.length} options each`);
}

async function fetchAssetMetadata(assetCode, assetIssuer, assetCard) {
  try {
    // Try Stellar Expert API first (via our proxy)
    const stellarExpertUrl = `/mini-app/asset-metadata/${assetCode}/${assetIssuer}`;    
    const response = await fetch(stellarExpertUrl);

    if (response.ok) {
      const result = await response.json();

      if (result.success && result.data.icon && result.data.icon !== '') {
        // Update the asset card with real icon
        const iconContainer = assetCard.querySelector('.asset-icon');
        const fallbackSpan = iconContainer.querySelector('.asset-icon-fallback');   
        const imgElement = iconContainer.querySelector('.asset-icon-img');

        if (imgElement && fallbackSpan) {
          imgElement.src = result.data.icon;
          imgElement.style.display = 'block';
          fallbackSpan.style.display = 'none';
        }

        // Update asset name if available
        if (result.data.name && result.data.name !== assetCode) {
          const nameElement = assetCard.querySelector('.asset-name');
          if (nameElement) {
            nameElement.textContent = result.data.name;
          }
        }

        console.log(`✅ Loaded Stellar Expert metadata for ${assetCode}:`, result.data.name, result.data.icon);
        return;
      }
    }

    // Fallback: Try TOML file if Stellar Expert doesn't have icon
    await fetchAssetFromToml(assetCode, assetIssuer, assetCard);

  } catch (error) {
    console.log(`❌ Stellar Expert failed for ${assetCode}:`, error);
    // Try TOML fallback
    try {
      await fetchAssetFromToml(assetCode, assetIssuer, assetCard);
    } catch (tomlError) {
      console.log(`❌ TOML also failed for ${assetCode}:`, tomlError);
    }
  }
}

async function fetchAssetFromToml(assetCode, assetIssuer, assetCard) {
  try {
    // Use our TOML proxy endpoint
    const tomlUrl = `/mini-app/toml-metadata/${assetCode}/${assetIssuer}`;
    const tomlResponse = await fetch(tomlUrl);

    if (tomlResponse.ok) {
      const result = await tomlResponse.json();

      if (result.success && result.data.icon) {
        const iconContainer = assetCard.querySelector('.asset-icon');
        const fallbackSpan = iconContainer.querySelector('.asset-icon-fallback');   
        const imgElement = iconContainer.querySelector('.asset-icon-img');

        if (imgElement && fallbackSpan) {
          imgElement.src = result.data.icon;
          imgElement.style.display = 'block';
          fallbackSpan.style.display = 'none';
        }

        // Update asset name if available
        if (result.data.name && result.data.name !== assetCode) {
          const nameElement = assetCard.querySelector('.asset-name');
          if (nameElement) {
            nameElement.textContent = result.data.name;
          }
        }

        console.log(`✅ Loaded TOML metadata for ${assetCode}:`, result.data.name, result.data.icon);
      }
    }
  } catch (error) {
    console.log(`❌ TOML fetch failed for ${assetCode}:`, error);
  }
}

async function getXlmEquivalent(asset, amount) {
  // This function is already in Utils module
  return window.Utils.getXlmEquivalent(asset, amount);
}

async function getAssetMetadata(assetCode, assetIssuer) {
  // Alias for fetchAssetMetadata
  return fetchAssetMetadata(assetCode, assetIssuer);
}

function formatAssetBalance(balance) {
  return parseFloat(balance).toFixed(7);
}
