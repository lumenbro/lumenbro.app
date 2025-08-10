// public/mini-app/clear.js - Client-side clear (Cloud Storage only)
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
