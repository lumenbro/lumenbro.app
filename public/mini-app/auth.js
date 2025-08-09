// public/mini-app/auth.js - Client-side registration (no WebAuthn)
window.register = async function () {
    try {
        if (!window.Turnkey || !window.Turnkey.generateP256ApiKeyPair) {
            console.error('Turnkey bundle not loaded or generateP256ApiKeyPair missing. Check Network tab for /static/turnkey.min.js load (200 OK). Rebuild bundle and ensure path in index.html.');
            throw new Error('Turnkey not available');
        }

        // Get telegram_id from initData (secure) with check
        if (!window.Telegram.WebApp || !window.Telegram.WebApp.initDataUnsafe || !window.Telegram.WebApp.initDataUnsafe.user) {
            console.error('Telegram WebApp not initialized or user data missing. Check if loaded in Mini App context.');
            throw new Error('Telegram data not available');
        }
        const telegram_id = window.Telegram.WebApp.initDataUnsafe.user.id;
        const referrer_id = window.params.get('referrer_id') || null;  // From query param

        // Check if already registered by seeing if key in cloud
        const existingKey = await new Promise((resolve) => {
            window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
                resolve(value ? JSON.parse(value) : null);
            });
        });
        if (existingKey) {
            console.log('Existing key found in cloud – already registered:', existingKey);
            document.getElementById('content').innerHTML = 'Already registered! Use Login or Recover.';
            return;  // Skip the rest
        }

        // Prompt for email
        const email = prompt('Enter your email:') || 'unknown@lumenbro.com';

        // NEW: Prompt for password to encrypt private key
        const password = prompt('Create a password for key encryption:');
        if (!password) throw new Error('Password required');

        // Generate P256 keypair for API keys (no WebAuthn)
        const keyPair = await window.Turnkey.generateP256ApiKeyPair();

        // NEW: Encrypt private key with password-derived key
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']),
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedPrivateKey = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          derivedKey,
          new TextEncoder().encode(keyPair.privateKey)
        );

        // Store encrypted data in Telegram Cloud
        const encryptedData = {
          publicKey: keyPair.publicKey,
          encryptedPrivateKey: Array.from(new Uint8Array(encryptedPrivateKey)),
          iv: Array.from(iv),
          salt: Array.from(salt)
        };
        try {
          await new Promise((resolve, reject) => {
            window.Telegram.WebApp.CloudStorage.setItem('TURNKEY_API_KEY', JSON.stringify(encryptedData), (error) => {
              if (error) reject(new Error(`Cloud storage failed: ${error}`));
              else resolve();
            });
          });
          console.log('Encrypted data stored successfully');
        } catch (error) {
          console.error('Encryption/storage error:', error);
          throw new Error('Failed to store encrypted key - try again');
        }

        // Fetch sub-org from backend (send public key for root user API key)
        const response = await fetch('/mini-app/create-sub-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id,
                initData: window.Telegram.WebApp.initData,
                email,
                apiPublicKey: keyPair.publicKey,  // Send public for sub-org creation
                referrer_id
            })
        });
        if (!response.ok) throw new Error('Backend error: ' + response.statusText);
        const result = await response.json();
        
        // ADDED: Handle legacy user detection response
        if (result.isLegacy) {
            const migrationMessage = `
                <div style="background: #f0f8ff; border: 1px solid #0066cc; padding: 15px; margin: 10px 0; border-radius: 5px;">
                    <h3>🔄 Legacy User Migration</h3>
                    <p>Welcome back! We've detected you're a legacy user. Your pioneer status (${result.pioneerStatus || 'None'}) has been preserved.</p>
                    <p>Your account has been successfully migrated to the new system.</p>
                    <button onclick="continueRegistration()" style="background: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                        Continue Setup
                    </button>
                </div>
            `;
            document.getElementById('content').innerHTML = migrationMessage;
            return;
        }

        // Create stamper and store RAW PRIVATE key in Telegram Cloud
        const stamper = await window.Turnkey.TelegramCloudStorageStamper.create({
            cloudStorageAPIKey: {
                apiPublicKey: keyPair.publicKey,
                apiPrivateKey: keyPair.privateKey
            }
        });

        // Show email verification step
        showEmailVerification(telegram_id, email, result);
    } catch (error) {
        console.error(error);
        document.getElementById('content').innerHTML = 'Error: ' + error.message;
    }
};

// ADDED: Function to continue registration after migration notification
async function continueRegistration() {
    // Re-run the registration process
    await register();
}

// NEW: Email verification functions
function showEmailVerification(telegram_id, email, registrationResult) {
    // Store data for verification
    window.registrationData = { telegram_id, email, registrationResult };
    
    document.getElementById('content').innerHTML = `
        <div style="background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; margin: 10px 0; border-radius: 5px;">
            <h3>✅ Wallet Created Successfully!</h3>
            <p><strong>Organization ID:</strong> ${registrationResult.subOrgId || 'Created'}</p>
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px;">
            <h3>📧 Email Verification Required</h3>
            <p>We've sent a verification code to <strong>${email}</strong></p>
            <p>Please check your email and enter the verification code below:</p>
            <input type="text" id="verificationCode" placeholder="Enter verification code" style="margin: 10px 0; padding: 10px; width: 100%; border: 1px solid #ddd; border-radius: 4px;">
            <button onclick="verifyEmail()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; width: 100%;">Verify Email</button>
            <p style="font-size: 0.9em; color: #666; margin-top: 10px;">⚠️ Email recovery won't work until verified. You can complete this later in settings.</p>
            <button onclick="skipVerification()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">Skip for Now</button>
        </div>
    `;
}

async function verifyEmail() {
    try {
        const verificationCode = document.getElementById('verificationCode').value.trim();
        if (!verificationCode) {
            alert('Please enter the verification code');
            return;
        }

        const { telegram_id, email } = window.registrationData;

        document.getElementById('content').innerHTML = 'Verifying email...';

        const response = await fetch('/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id,
                email,
                verificationCode
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Verification failed');
        }

        document.getElementById('content').innerHTML = `
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>✅ Email Verified Successfully!</h3>
                <p>Your email has been verified. Email recovery is now enabled for your wallet.</p>
                <p>You can now <a href="/mini-app?action=login">login</a> to access your wallet.</p>
            </div>
        `;

    } catch (error) {
        console.error('Verification error:', error);
        document.getElementById('content').innerHTML = `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>❌ Verification Failed</h3>
                <p>Error: ${error.message}</p>
                <button onclick="showEmailVerification('${window.registrationData.telegram_id}', '${window.registrationData.email}', window.registrationData.registrationResult)" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
            </div>
        `;
    }
}

function skipVerification() {
    document.getElementById('content').innerHTML = `
        <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 10px 0; border-radius: 5px;">
            <h3>📱 Registration Complete!</h3>
            <p>Your wallet has been created successfully.</p>
            <p><strong>Note:</strong> Email recovery is disabled until you verify your email.</p>
            <p>You can verify your email later in wallet settings.</p>
            <p>You can now <a href="/mini-app?action=login">login</a> to access your wallet.</p>
        </div>
    `;
}
