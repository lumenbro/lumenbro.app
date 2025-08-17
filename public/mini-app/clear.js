// public/mini-app/clear.js - Client-side clear (Cloud Storage only)

// Show warning before clearing data
window.showClearWarning = function() {
    // Safety check: Don't allow clearing on sensitive pages
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const sensitiveActions = ['export', 'recover'];
    
    if (sensitiveActions.includes(action)) {
        alert('⚠️ Clear Data is not available on this page for security reasons.');
        return;
    }
    
    // Additional safety check for production
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isProduction) {
        const confirmed = confirm('⚠️ SECURITY WARNING: This will permanently delete your API keys from Telegram Cloud Storage. Are you sure you want to continue?');
        if (!confirmed) return;
    }
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        align-items: center; justify-content: center; padding: 20px;
    `;
    
    warningDiv.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h3 style="color: #dc3545; margin-bottom: 15px;">Clear All Data?</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                This will remove all stored keys and data from your device. 
                You'll need to log in again to access your wallet.
            </p>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h4 style="color: #856404; margin-top: 0; font-size: 14px;">What will be cleared:</h4>
                <ul style="text-align: left; margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
                    <li>Encrypted API keys</li>
                    <li>Session data</li>
                    <li>Wallet credentials</li>
                    <li>Local storage data</li>
                </ul>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="this.closest('div[style*=\'position: fixed\']').remove()" 
                        style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Cancel
                </button>
                <button onclick="window.confirmClear()" 
                        style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Yes, Clear Data
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(warningDiv);
};

// Confirm clear action
window.confirmClear = function() {
    // Remove warning modal
    const warningModal = document.querySelector('div[style*="position: fixed"]');
    if (warningModal) warningModal.remove();
    
    // Proceed with clearing
    window.unregister();
};

window.unregister = async function () {
    try {
        showStatus('Clearing local data...', 'loading');
        
        // Clear all Telegram Cloud Storage keys
        const keysToClear = [
            'TURNKEY_API_KEY',
            'TURNKEY_API_PRIVATE_KEY', 
            'TURNKEY_API_PUBLIC_KEY',
            'ENCRYPTED_API_KEYS',
            'WALLET_ORG_ID',
            'WALLET_ID',
            'USER_EMAIL',
            'SESSION_DATA'
        ];
        
        for (const key of keysToClear) {
            await new Promise((resolve, reject) => {
                Telegram.WebApp.CloudStorage.removeItem(key, (error) => {
                    if (error) {
                        console.error(`Error clearing ${key}:`, error);
                        // Don't reject, just log the error
                    } else {
                        console.log(`${key} cleared from cloud storage`);
                    }
                    resolve();
                });
            });
        }
        
        // Clear session storage as well
        sessionStorage.clear();
        localStorage.clear();
        
        showStatus('✅ Local data cleared successfully!', 'success');
        
        // Update UI
        document.getElementById('content').innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h3 style="color: #4CAF50;">🧹 Data Cleared Successfully</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    All local data has been removed from your device.
                </p>
                <div style="background: #f0f8f0; border: 1px solid #4CAF50; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #2E7D32; margin-top: 0;">📋 What was cleared:</h4>
                    <ul style="text-align: left; margin: 0; padding-left: 20px;">
                        <li>Telegram Cloud Storage keys</li>
                        <li>Session storage data</li>
                        <li>Local storage data</li>
                    </ul>
                </div>
                <div style="background: #fff3e0; border: 1px solid #ff9800; padding: 15px; border-radius: 8px;">
                    <h4 style="color: #e65100; margin-top: 0;">⚠️ Important:</h4>
                    <p style="margin: 0; color: #666;">
                        Your wallet data is still safe in the database. 
                        You can log in again to regain access.
                    </p>
                </div>
                <button onclick="location.reload()" style="margin-top: 20px; background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    🔄 Refresh Page
                </button>
            </div>
        `;
        
    } catch (error) {
        console.error('Clear error:', error);
        showStatus('Error clearing data: ' + error.message, 'error');
    }
};

// Helper function to show status
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status') || createStatusDiv();
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type !== 'loading') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

function createStatusDiv() {
    const div = document.createElement('div');
    div.id = 'status';
    div.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        padding: 10px 20px; border-radius: 5px; z-index: 1000;
        font-weight: bold; text-align: center; min-width: 200px;
    `;
    document.body.appendChild(div);
    return div;
}
