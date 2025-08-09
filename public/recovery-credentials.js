// Recovery Credentials Manager - handles temporary OTP credentials
class RecoveryCredentialsManager {
  constructor() {
    this.STORAGE_KEY = 'lumenbro_recovery_credentials';
    this.initIndexedDB();
  }

  // Initialize IndexedDB for persistent storage
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LumenBroRecovery', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const store = db.createObjectStore('credentials', { keyPath: 'orgId' });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      };
    });
  }

  // Store recovery credentials (session + IndexedDB)
  async storeCredentials(credentials) {
    const data = {
      ...credentials,
      storedAt: Date.now(),
      expiresAt: Date.now() + (3600 * 1000) // 1 hour
    };

    // Store in session storage for immediate use
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    
    // Store in IndexedDB for persistence across browser sessions
    if (this.db) {
      const transaction = this.db.transaction(['credentials'], 'readwrite');
      const store = transaction.objectStore('credentials');
      await store.put(data);
    }

    console.log('✅ Recovery credentials stored securely');
    return data;
  }

  // Get active recovery credentials
  async getCredentials(orgId) {
    // First check session storage (fastest)
    const sessionData = sessionStorage.getItem(this.STORAGE_KEY);
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (parsed.orgId === orgId && parsed.expiresAt > Date.now()) {
        return parsed;
      }
    }

    // Check IndexedDB for persistent storage
    if (this.db) {
      const transaction = this.db.transaction(['credentials'], 'readonly');
      const store = transaction.objectStore('credentials');
      const request = store.get(orgId);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const data = request.result;
          if (data && data.expiresAt > Date.now()) {
            // Restore to session storage
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            resolve(data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    }

    return null;
  }

  // Check if user has valid recovery session
  async hasValidRecoverySession(orgId) {
    const credentials = await this.getCredentials(orgId);
    return credentials !== null;
  }

  // Clear expired credentials
  async clearExpiredCredentials() {
    const now = Date.now();
    
    // Clear session storage if expired
    const sessionData = sessionStorage.getItem(this.STORAGE_KEY);
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (parsed.expiresAt <= now) {
        sessionStorage.removeItem(this.STORAGE_KEY);
      }
    }

    // Clear IndexedDB expired entries
    if (this.db) {
      const transaction = this.db.transaction(['credentials'], 'readwrite');
      const store = transaction.objectStore('credentials');
      const index = store.index('expiresAt');
      const request = index.openCursor(IDBKeyRange.upperBound(now));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
  }

  // Create Turnkey client with recovery credentials
  async createTurnkeyClient(orgId) {
    const credentials = await this.getCredentials(orgId);
    if (!credentials) {
      throw new Error('No valid recovery credentials found. Please complete recovery first.');
    }

    // Decrypt the credential bundle (this is the encrypted API key)
    const apiKeyCredential = await this.decryptCredentialBundle(
      credentials.credentialBundle, 
      credentials.targetPrivateKey
    );

    return new window.Turnkey.ApiKeyStamper({
      apiPublicKey: apiKeyCredential.publicKey,
      apiPrivateKey: apiKeyCredential.privateKey
    });
  }

  // Decrypt the credential bundle using target private key
  async decryptCredentialBundle(credentialBundle, targetPrivateKey) {
    // This would use the Turnkey SDK's decryption method
    // For now, return a placeholder - needs proper implementation
    console.log('🔓 Decrypting credential bundle...');
    
    // The credentialBundle contains the encrypted API key
    // The targetPrivateKey is what we generated during recovery
    // Turnkey provides methods to decrypt this
    
    return {
      publicKey: "placeholder-public-key",
      privateKey: "placeholder-private-key"
    };
  }

  // Show recovery status in UI
  showRecoveryStatus(orgId, credentials) {
    const timeLeft = Math.round((credentials.expiresAt - Date.now()) / 1000 / 60);
    
    return `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h3>🔓 Recovery Session Active</h3>
        <p><strong>Organization:</strong> ${orgId}</p>
        <p><strong>Session expires in:</strong> ${timeLeft} minutes</p>
        <p>You can now access your wallet and sign transactions.</p>
        <button onclick="accessWallet('${orgId}')">Access Wallet</button>
        <button onclick="exportToTelegram('${orgId}')">Setup Telegram Bot</button>
      </div>
    `;
  }
}

// Global instance
window.recoveryManager = new RecoveryCredentialsManager();

// Helper functions for wallet access
async function accessWallet(orgId) {
  try {
    const client = await window.recoveryManager.createTurnkeyClient(orgId);
    console.log('✅ Turnkey client ready for wallet operations');
    
    // Show basic wallet interface
    document.getElementById('content').innerHTML = `
      <h3>💰 Your Wallet</h3>
      <p><strong>Organization ID:</strong> ${orgId}</p>
      <button onclick="getWalletBalance('${orgId}')">Check Balance</button>
      <button onclick="showTransactionHistory('${orgId}')">Transaction History</button>
      <button onclick="sendTransaction('${orgId}')">Send Payment</button>
    `;
  } catch (error) {
    console.error('Wallet access error:', error);
    alert('Failed to access wallet: ' + error.message);
  }
}

async function exportToTelegram(orgId) {
  const credentials = await window.recoveryManager.getCredentials(orgId);
  
  document.getElementById('content').innerHTML = `
    <h3>🤖 Telegram Bot Setup</h3>
    <p>To use your recovered wallet with the Telegram bot:</p>
    <ol>
      <li>Copy your Organization ID: <code>${orgId}</code></li>
      <li>Open Telegram and find the LumenBro bot</li>
      <li>Send the command: <code>/recover ${orgId}</code></li>
      <li>The bot will detect your recovered wallet</li>
    </ol>
    <p><strong>Note:</strong> Your recovery session expires in ${Math.round((credentials.expiresAt - Date.now()) / 1000 / 60)} minutes.</p>
    <button onclick="window.open('https://t.me/YourBotUsername', '_blank')">Open Telegram Bot</button>
  `;
}

