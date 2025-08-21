// utils.js - Utility functions and constants
// Handles: Helper functions, constants, common utilities

window.Utils = {
  // Constants
  FEE_WALLET_ADDRESS: 'GDEBQ4WBATSSCNULGKBTUFMSSED5BGLVDJKMRS3GFVSQULIEJX6UXZBL',
  NETWORK_FEE: 0.00001,
  SERVICE_FEE_RATE: 0.001,
  
  // Utility functions
  getXlmEquivalent,
  calculateProperFees,
  formatNumber,
  validateStellarAddress,
  validateAmount,
  debounce,
  throttle,
  
  // Crypto utilities
  generateUUID,
  hashString,
  
  // Date utilities
  formatDate,
  formatTime,
  
  // Initialization
  init: function() {
    console.log('🔧 Utils initialized');
    console.log('✅ Utils module loaded successfully');
    console.log('📊 Available constants:', {
      FEE_WALLET_ADDRESS: this.FEE_WALLET_ADDRESS,
      NETWORK_FEE: this.NETWORK_FEE,
      SERVICE_FEE_RATE: this.SERVICE_FEE_RATE
    });
    console.log('🔧 Available utility functions:', {
      getXlmEquivalent: typeof this.getXlmEquivalent,
      calculateProperFees: typeof this.calculateProperFees,
      formatNumber: typeof this.formatNumber,
      validateStellarAddress: typeof this.validateStellarAddress,
      validateAmount: typeof this.validateAmount,
      debounce: typeof this.debounce,
      throttle: typeof this.throttle,
      generateUUID: typeof this.generateUUID,
      hashString: typeof this.hashString,
      formatDate: typeof this.formatDate,
      formatTime: typeof this.formatTime
    });
  }
};

// Utility functions migrated from index.html
async function getXlmEquivalent(asset, amount) {
  try {
    console.log(`🔍 Getting XLM equivalent for ${amount} ${asset.code}`);
    
    // Use Stellar SDK to find path payment
    if (window.StellarSdk) {
      const server = new window.StellarSdk.Server('https://horizon.stellar.org');
      
      // Create asset object
      const stellarAsset = asset.code === 'XLM' ? 
        window.StellarSdk.Asset.native() : 
        new window.StellarSdk.Asset(asset.code, asset.issuer);
      
      // Find strict send paths to XLM
      const pathsResponse = await server.strictSendPaths(stellarAsset, amount.toString(), [window.StellarSdk.Asset.native()])
        .limit(1)
        .call();
      
      if (pathsResponse.records && pathsResponse.records.length > 0) {
        const xlmAmount = parseFloat(pathsResponse.records[0].destination_amount);
        console.log(`✅ XLM equivalent for ${amount} ${asset.code}: ${xlmAmount} XLM`);
        return xlmAmount;
      } else {
        console.warn(`⚠️ No paths found for ${asset.code} to XLM, using fallback`);
        return 0.0;
      }
    } else {
      console.warn('⚠️ Stellar SDK not available, using fallback');
      return 0.0;
    }
  } catch (error) {
    console.error(`❌ Error getting XLM equivalent for ${asset.code}:`, error);
    return 0.0;
  }
}

async function calculateProperFees(transaction) {
  try {
    const amount = parseFloat(transaction.amount);
    const asset = transaction.asset;
    
    // Network fee is always 0.00001 XLM
    const networkFee = 0.00001;
    
    // Calculate service fee based on XLM equivalent
    let serviceFee = 0.00001; // Default minimum
    
    if (asset === 'XLM') {
      // For XLM, calculate fee directly
      serviceFee = Math.max(0.00001, amount * 0.001);
    } else {
      // For non-XLM assets, get XLM equivalent first
      const xlmEquivalent = await getXlmEquivalent(asset, amount);
      serviceFee = Math.max(0.00001, xlmEquivalent * 0.001);
    }
    
    // Calculate total (amount sent + fees)
    let total;
    if (asset === 'XLM') {
      total = amount + networkFee + serviceFee;
    } else {
      // For non-XLM assets, total is just the fees (amount is in the asset)
      total = networkFee + serviceFee;
    }
    
    return {
      networkFee: networkFee.toFixed(5),
      serviceFee: serviceFee.toFixed(5),
      total: total.toFixed(5)
    };
  } catch (error) {
    console.error('Error calculating proper fees:', error);
    return {
      networkFee: '0.00001',
      serviceFee: '0.00001',
      total: '0.00002'
    };
  }
}

function formatNumber(number, decimals = 7) {
  if (typeof number !== 'number' || isNaN(number)) {
    return '0.0000000';
  }
  return number.toFixed(decimals);
}

function validateStellarAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  // Stellar addresses start with G and are 56 characters long
  return /^G[A-Z2-7]{55}$/.test(address);
}

function validateAmount(amount) {
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return false;
  }
  return true;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function hashString(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString();
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString();
}
