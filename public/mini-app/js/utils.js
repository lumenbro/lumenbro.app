// utils.js - Utility functions and constants
// Handles: Helper functions, constants, common utilities

window.Utils = {
  // Constants
  FEE_WALLET_ADDRESS: 'GDEBQ4WBATSSCNULGKBTUFMSSED5BGLVDJKMRS3GFVSQULIEJX6UXZBL',
  NETWORK_FEE: 0.00001,
  SERVICE_FEE_RATE: 0.001,
  
  // Utility functions
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
  }
};

// Utility functions will be moved here
function formatNumber(number, decimals = 7) {
  // TODO: Move from index.html
}

function validateStellarAddress(address) {
  // TODO: Move from index.html
}

function validateAmount(amount) {
  // TODO: Move from index.html
}

function debounce(func, wait) {
  // TODO: Move from index.html
}

function throttle(func, limit) {
  // TODO: Move from index.html
}

function generateUUID() {
  // TODO: Move from index.html
}

function hashString(str) {
  // TODO: Move from index.html
}

function formatDate(date) {
  // TODO: Move from index.html
}

function formatTime(date) {
  // TODO: Move from index.html
}
