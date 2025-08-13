// public/mini-app/auth.js - Client-side registration (no WebAuthn)
window.register = async function () {
    try {
        // Enhanced mobile error handling
        if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
            console.log('🔧 Mobile registration detected - applying enhanced error handling');
        }

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

        // Use standardized encryption
        try {
            const storedData = await window.EncryptionUtils.storeTelegramKey(keyPair.publicKey, keyPair.privateKey, password);
            console.log('Encrypted data stored successfully');
        } catch (error) {
            console.error('Encryption/storage error:', error);
            
            // Enhanced mobile error handling
            if (window.mobileEncryptionFix && window.mobileEncryptionFix.isMobile) {
                console.error('❌ Mobile encryption error during registration:', error);
                MobileEncryptionFix.handleMobileError(error, 'registration encryption');
                
                // Show user-friendly error message
                document.getElementById('content').innerHTML = `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                        <h3>❌ Mobile Registration Error</h3>
                        <p>There was an issue encrypting your keys on mobile. This is likely due to:</p>
                        <ul>
                            <li>Web Crypto API limitations on mobile</li>
                            <li>Data format compatibility issues</li>
                            <li>Telegram WebView restrictions</li>
                        </ul>
                        <p><strong>Try:</strong></p>
                        <ul>
                            <li>Using desktop version</li>
                            <li>Checking the debug console (🐛 button)</li>
                            <li>Ensuring you have a stable internet connection</li>
                        </ul>
                        <button onclick="window.mobileDebug && window.mobileDebug.toggle()" style="background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
                            🐛 Show Debug Info
                        </button>
                    </div>
                `;
                return;
            }
            
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

        // Keys are already encrypted and stored above - no need for TelegramCloudStorageStamper
        // The TelegramCloudStorageStamper.create() would overwrite our encrypted keys with plaintext
        console.log('Encrypted keys stored securely in Telegram Cloud Storage');

        // Registration complete - email is registered with Turnkey for recovery
        document.getElementById('content').innerHTML = `
            <div style="background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>✅ Registration Complete!</h3>
                <p>Your wallet has been created successfully.</p>
                <p><strong>Organization ID:</strong> ${result.subOrgId || 'Created'}</p>
                <p>You can now <a href="/mini-app?action=login">login</a> to access your wallet.</p>
            </div>
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>📧 Email Recovery Enabled</h3>
                <p>Your email <strong>${email}</strong> has been registered with your wallet.</p>
                <p>If you lose access to Telegram, you can recover using: <a href="/recovery" target="_blank">Email Recovery</a></p>
                <p><strong>Keep safe:</strong> Your password and this email access!</p>
                <div class="tk-badge" style="margin-top:8px;">
                  <img src="/media/Turnkey%20-%20gray.svg" alt="Turnkey" />
                  Wallets powered by Turnkey
                </div>
            </div>
        `;

        // Show success message
        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = `
            <div id="successMessage" style="background: #e8f5e8; border: 1px solid #4CAF50; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #2E7D32; margin-top: 0;">✅ Registration Successful!</h2>
                <p><strong>Your Turnkey wallet has been created successfully!</strong></p>
                <p>You can now use the bot to trade Stellar assets.</p>
                <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px;">
                    <h4>🔐 Security Information:</h4>
                    <p>Your API keys are encrypted and stored securely in Telegram Cloud Storage.</p>
                    <p>If you lose access to Telegram, you can recover using: <a href="/recovery" target="_blank">Email Recovery</a></p>
                    <p><strong>Keep safe:</strong> Your password and this email access!</p>
                </div>
            </div>
        `;
        
        // DEBUG: Log registration response for testing
        console.log('🔍 REGISTRATION DEBUG INFO:');
        console.log('Sub-org ID:', result.activity?.result?.createSubOrganizationResultV7?.subOrganizationId);
        console.log('Wallet ID:', result.activity?.result?.createSubOrganizationResultV7?.wallet?.walletId);
        console.log('User IDs:', result.activity?.result?.createSubOrganizationResultV7?.rootUserIds);
        console.log('Full response:', result);
        
        // Store IDs in session for export testing
        if (result.activity?.result?.createSubOrganizationResultV7) {
            const subOrgId = result.activity.result.createSubOrganizationResultV7.subOrganizationId;
            const walletId = result.activity.result.createSubOrganizationResultV7.wallet?.walletId;
            
            sessionStorage.setItem('subOrgId', subOrgId);
            sessionStorage.setItem('walletId', walletId);
            
            console.log('💾 Stored for testing:');
            console.log('  Sub-org ID:', subOrgId);
            console.log('  Wallet ID:', walletId);
        }
        
        // Compute subOrgId for export redirect (fallback to result.subOrgId)
        const computedSubOrgId = (
            result.subOrgId ||
            (result.activity && result.activity.result && result.activity.result.createSubOrganizationResultV7
                ? result.activity.result.createSubOrganizationResultV7.subOrganizationId
                : '')
        );

        // Add export wallet option (redirect to unified export flow)
        const exportSection = document.createElement('div');
        exportSection.innerHTML = `
            <div class="export-section" style="margin-top: 20px; padding: 15px; border: 2px solid #4CAF50; border-radius: 8px; background: #f0f8f0;">
                <h3 style="color: #2E7D32; margin-top: 0;">🔐 Wallet Backup</h3>
                <p style="margin-bottom: 15px; color: #555;">
                    <strong>Important:</strong> Export your wallet keys for backup. You'll need these if you lose access to Telegram.
                </p>
                <button onclick="window.location.href='/mini-app/index.html?action=export&orgId=' + (sessionStorage.getItem('subOrgId') || '${computedSubOrgId}') + '&email=${encodeURIComponent(email)}'" class="btn btn-warning" style="background: #FF9800; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    📤 Export Wallet Keys
                </button>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    ⚠️ Store these keys securely offline. Never share them with anyone.
                </p>
            </div>
        `;
        document.getElementById('successMessage').appendChild(exportSection);

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

// ADDED: Function to handle export from mini-app
async function showExportForm() {
    try {
        console.log('🔍 Starting export from mini-app...');
        
        // Check if we have the required parameters
        if (!window.orgId || !window.email) {
            document.getElementById('content').innerHTML = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                    <h3>❌ Missing Parameters</h3>
                    <p>Organization ID or email not found in URL parameters.</p>
                    <p>Please use the export button from the bot menu.</p>
                </div>
            `;
            return;
        }
        
        // Show export form
        document.getElementById('content').innerHTML = `
            <div style="background: #e8f5e8; border: 1px solid #4CAF50; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #2E7D32; margin-top: 0;">🔐 Export Wallet Keys</h2>
                <p><strong>Organization ID:</strong> ${window.orgId}</p>
                <p><strong>Email:</strong> ${window.email}</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px;">
                <h3>📧 Enter Your Password</h3>
                <p>Enter the password you used to encrypt your API keys:</p>
                <input type="password" id="exportPassword" placeholder="Enter your password" style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
                <button onclick="startExport()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; width: 100%;">🔐 Export Wallet Keys</button>
            </div>
            
            <div id="exportStatus" style="display: none; padding: 10px; margin: 10px 0; border-radius: 5px; font-weight: bold;"></div>
            <div id="exportResults" style="display: none;"></div>
        `;
        
    } catch (error) {
        console.error('Export error:', error);
        document.getElementById('content').innerHTML = `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>❌ Export Error</h3>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

// ADDED: Function to start the export process
async function startExport() {
    try {
        const passwordField = document.getElementById('exportPassword');
        if (!passwordField) {
            showExportStatus('❌ Password field not found. Please refresh the page.', 'error');
            return;
        }
        
        const password = passwordField.value;
        console.log('🔍 Password field found, length:', password ? password.length : 0);
        console.log('🔍 Password field value:', password ? '***' + password.substring(password.length - 2) : 'empty');
        console.log('🔍 Password field type:', passwordField.type);
        console.log('🔍 Password field placeholder:', passwordField.placeholder);
        
        if (!password) {
            showExportStatus('❌ Please enter your password', 'error');
            return;
        }
        
        showExportStatus('🔍 Starting export process...', 'loading');
        
        // Step 1: Get user's API keys from Telegram Cloud Storage
        console.log('🔍 Attempting to retrieve API keys with password...');
        const apiKeyPair = await EncryptionUtils.retrieveTelegramKey(password);
        if (!apiKeyPair) {
            showExportStatus('❌ No API keys found. Please check your password.', 'error');
            return;
        }
        
        console.log('✅ API keys retrieved successfully:', {
            hasApiPublicKey: !!apiKeyPair.apiPublicKey,
            hasApiPrivateKey: !!apiKeyPair.apiPrivateKey,
            apiPublicKeyLength: apiKeyPair.apiPublicKey?.length,
            apiPrivateKeyLength: apiKeyPair.apiPrivateKey?.length
        });
        
        showExportStatus('✅ API keys decrypted successfully', 'success');
        
        // Step 2: Get wallet information
        const walletInfo = await getWalletInfo(window.email, apiKeyPair);
        if (!walletInfo) {
            showExportStatus('❌ Wallet not found. Please check your email.', 'error');
            return;
        }
        
        showExportStatus('✅ Wallet information retrieved', 'success');
        
        // Step 3: Export wallet account
        const result = await ExportUtils.exportWalletAccount(
            walletInfo.subOrgId,
            walletInfo.walletAccountId,
            walletInfo.stellarAddress,
            apiKeyPair.apiPublicKey,
            apiKeyPair.apiPrivateKey
        );
        
        // Display results
        displayExportResults(result, walletInfo.stellarAddress);
        
        showExportStatus('✅ Export completed successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showExportStatus('❌ Export failed: ' + error.message + ' (Type: ' + error.name + ')', 'error');
    }
}

// ADDED: Helper function to get wallet info
async function getWalletInfo(email, apiKeyPair) {
    try {
        console.log('🔍 Getting wallet info for email:', email);
        console.log('🔍 API key pair structure:', {
            hasApiPublicKey: !!apiKeyPair.apiPublicKey,
            hasApiPrivateKey: !!apiKeyPair.apiPrivateKey
        });
        
        // Call backend API to get wallet information
        const response = await fetch('/api/wallet-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                apiPublicKey: apiKeyPair.apiPublicKey,
                apiPrivateKey: apiKeyPair.apiPrivateKey
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get wallet info');
        }

        const data = await response.json();
        return data.walletInfo;
    } catch (error) {
        console.error('Error getting wallet info:', error);
        throw error;
    }
}

// ADDED: Helper function to display export results
function displayExportResults(result, stellarAddress) {
    const resultsDiv = document.getElementById('exportResults');
    
    if (result.needsManualDecryption) {
        // Show manual decryption info
        resultsDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 2px solid #e9ecef; margin-top: 20px;">
                <h3>🔐 Export Bundle Ready!</h3>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <strong>⚠️ Manual Decryption Required:</strong><br>
                    • The export bundle has been created successfully<br>
                    • Manual decryption is needed to extract the private key<br>
                    • This is a temporary solution while we fix the decryption
                </div>

                <div>
                    <label><strong>Export Bundle:</strong></label>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 10px; word-break: break-all; margin: 10px 0; border: 1px solid #dee2e6; max-height: 200px; overflow-y: auto;">${result.exportBundle}</div>
                    <button onclick="copyToClipboard('${result.exportBundle}')" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px 5px 5px 0;">📋 Copy Bundle</button>
                </div>

                <div style="margin-top: 20px;">
                    <label><strong>Ephemeral Private Key (for decryption):</strong></label>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 10px; word-break: break-all; margin: 10px 0; border: 1px solid #dee2e6;">${result.ephemeralPrivateKey}</div>
                    <button onclick="copyToClipboard('${result.ephemeralPrivateKey}')" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px 5px 5px 0;">📋 Copy Private Key</button>
                </div>

                <div style="margin-top: 20px;">
                    <label><strong>Stellar Public Address:</strong></label>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 10px 0; border: 1px solid #dee2e6;">${stellarAddress}</div>
                    <button onclick="copyToClipboard('${stellarAddress}')" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px 5px 5px 0;">📋 Copy Address</button>
                </div>

                <div style="background: #e3f2fd; border: 1px solid #2196f3; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <strong>💡 Next Steps:</strong><br>
                    • Copy the export bundle and ephemeral private key<br>
                    • Use a tool to decrypt the bundle with the private key<br>
                    • The decrypted result will contain your Stellar private key
                </div>
            </div>
        `;
    } else {
        // Show normal export results
        resultsDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 2px solid #e9ecef; margin-top: 20px;">
                <h3>✅ Export Successful!</h3>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <strong>⚠️ Security Warning:</strong><br>
                    • Never share these keys with anyone<br>
                    • Store them offline in a secure location<br>
                    • These keys give full access to your wallet<br>
                    • We cannot recover your funds if you lose these keys
                </div>

                <div>
                    <label><strong>Stellar Private Key (Hex):</strong></label>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 10px 0; border: 1px solid #dee2e6;">${result.stellarPrivateKey}</div>
                    <button onclick="copyToClipboard('${result.stellarPrivateKey}')" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px 5px 5px 0;">📋 Copy Private Key</button>
                </div>

                <div style="margin-top: 20px;">
                    <label><strong>Stellar S-Address:</strong></label>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 10px 0; border: 1px solid #dee2e6;">${result.stellarSAddress}</div>
                    <button onclick="copyToClipboard('${result.stellarSAddress}')" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px 5px 5px 0;">📋 Copy S-Address</button>
                </div>

                <div style="margin-top: 20px;">
                    <label><strong>Stellar Public Address:</strong></label>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 10px 0; border: 1px solid #dee2e6;">${stellarAddress}</div>
                    <button onclick="copyToClipboard('${stellarAddress}')" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 5px 5px 5px 0;">📋 Copy Public Address</button>
                </div>

                <button onclick="downloadBackup('${result.stellarPrivateKey}', '${result.stellarSAddress}', '${stellarAddress}')" style="background: #27ae60; color: white; border: none; padding: 15px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 20px; width: 100%;">💾 Download Backup File</button>
            </div>
        `;
    }
    
    resultsDiv.style.display = 'block';
}

// ADDED: Helper function to show export status
function showExportStatus(message, type) {
    const statusDiv = document.getElementById('exportStatus');
    if (!statusDiv) {
        console.error('Export status div not found');
        return;
    }
    
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    // Apply styling based on type
    switch (type) {
        case 'loading':
            statusDiv.style.background = '#e3f2fd';
            statusDiv.style.border = '1px solid #2196f3';
            statusDiv.style.color = '#1976d2';
            break;
        case 'success':
            statusDiv.style.background = '#e8f5e8';
            statusDiv.style.border = '1px solid #4caf50';
            statusDiv.style.color = '#2e7d32';
            break;
        case 'error':
            statusDiv.style.background = '#ffebee';
            statusDiv.style.border = '1px solid #f44336';
            statusDiv.style.color = '#c62828';
            break;
        default:
            statusDiv.style.background = '#fff3cd';
            statusDiv.style.border = '1px solid #ffc107';
            statusDiv.style.color = '#856404';
    }

    if (type !== 'loading') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// ADDED: Helper function to copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showExportStatus('✅ Copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy failed:', error);
        showExportStatus('❌ Copy failed', 'error');
    }
}

// ADDED: Helper function to download backup
function downloadBackup(stellarPrivateKey, stellarSAddress, stellarAddress) {
    try {
        const backupContent = ExportUtils.createBackupFileContent(
            stellarPrivateKey,
            stellarSAddress,
            stellarAddress
        );

        ExportUtils.downloadAsFile(backupContent, `lumenbro-wallet-backup-${Date.now()}.txt`);
        showExportStatus('✅ Backup file downloaded!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showExportStatus('❌ Download failed: ' + error.message, 'error');
    }
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

// Export wallet function
async function exportWallet() {
    try {
        showStatus('Preparing wallet export...', 'loading');
        
        // Get user's API keys from Telegram Cloud Storage
        const apiKeyPair = await EncryptionUtils.retrieveTelegramKey();
        if (!apiKeyPair) {
            throw new Error('No API keys found. Please log in first.');
        }
        
        // Get wallet info from session storage (set during registration)
        const subOrgId = sessionStorage.getItem('subOrgId');
        const walletId = sessionStorage.getItem('walletId');
        
        if (!subOrgId || !walletId) {
            throw new Error('Wallet information not found. Please try registering again.');
        }
        
        console.log('Exporting wallet account:', { subOrgId, walletId });
        
        // Get wallet accounts to find the account ID and Stellar address
        const userClient = new window.Turnkey({
            apiBaseUrl: "https://api.turnkey.com",
            apiPublicKey: apiKeyPair.publicKey,
            apiPrivateKey: apiKeyPair.privateKey,
            defaultOrganizationId: subOrgId,
        });
        
        // Get wallet accounts
        const wallets = await userClient.apiClient().getWallets({
            organizationId: subOrgId
        });
        
        if (!wallets.wallets || wallets.wallets.length === 0) {
            throw new Error('No wallets found');
        }
        
        const wallet = wallets.wallets[0];
        const stellarAddress = wallet.addresses?.[0];
        
        if (!stellarAddress) {
            throw new Error('No Stellar address found');
        }
        
        // Get wallet accounts to find the account ID
        const accounts = await userClient.apiClient().getWalletAccounts({
            organizationId: subOrgId,
            walletId: walletId
        });
        
        if (!accounts.accounts || accounts.accounts.length === 0) {
            throw new Error('No wallet accounts found');
        }
        
        const walletAccount = accounts.accounts[0];
        const walletAccountId = walletAccount.walletAccountId;
        
        console.log('Found wallet account:', { walletAccountId, stellarAddress });
        
        // Use the new ExportUtils to export the wallet account
        const exportResult = await ExportUtils.exportWalletAccount(
            subOrgId,
            walletAccountId,
            stellarAddress,
            apiKeyPair.publicKey,
            apiKeyPair.privateKey
        );
        
        // Show export results with Stellar format
        showExportResults(exportResult);
        
    } catch (error) {
        console.error('Export error:', error);
        showStatus('Export failed: ' + error.message, 'error');
    }
}

// Show export results in a secure modal
function showExportResults(exportResult) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    // Format keys for display
    const formattedPrivateKey = ExportUtils.formatPrivateKeyForDisplay(exportResult.stellarPrivateKey);
    const formattedSAddress = ExportUtils.formatSAddressForDisplay(exportResult.stellarSAddress);
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; max-height: 80vh; overflow-y: auto; position: relative;">
            <button onclick="confirmCloseExport()" style="position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-size: 16px; z-index: 1001; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                ✕ Close
            </button>
            <h2 style="color: #d32f2f; margin-top: 0;">🔐 Stellar Wallet Backup</h2>
            
            <div style="background: #fff3e0; border: 1px solid #ff9800; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #e65100;">⚠️ Security Warning</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Never share these keys with anyone</li>
                    <li>Store them offline in a secure location</li>
                    <li>These keys give full access to your Stellar wallet</li>
                    <li>We cannot recover your funds if you lose these keys</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Stellar Private Key (Hex):</label>
                <div style="position: relative;">
                    <input type="password" id="privateKeyDisplay" value="${exportResult.stellarPrivateKey}" 
                           readonly style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 12px;">
                    <button onclick="toggleKeyVisibility('privateKeyDisplay')" style="position: absolute; right: 5px; top: 5px; background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                        👁️ Show
                    </button>
                </div>
                <button onclick="copyElementToClipboard('privateKeyDisplay')" style="margin-top: 5px; background: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
                    📋 Copy Private Key
                </button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Stellar S-Address:</label>
                <div style="position: relative;">
                    <input type="password" id="sAddressDisplay" value="${exportResult.stellarSAddress}" 
                           readonly style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 12px;">
                    <button onclick="toggleKeyVisibility('sAddressDisplay')" style="position: absolute; right: 5px; top: 5px; background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                        👁️ Show
                    </button>
                </div>
                <button onclick="copyElementToClipboard('sAddressDisplay')" style="margin-top: 5px; background: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
                    📋 Copy S-Address
                </button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Formatted Keys (for easy reading):</label>
                <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px;">
                    <div><strong>Private Key:</strong></div>
                    <div style="word-break: break-all;">${formattedPrivateKey}</div>
                    <div style="margin-top: 10px;"><strong>S-Address:</strong></div>
                    <div style="word-break: break-all;">${formattedSAddress}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Download Backup File:</label>
                <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                    <button onclick="downloadBackupFile()" style="background: #FF9800; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%;">
                        💾 Download Plaintext Backup (.txt)
                    </button>
                    <button onclick="downloadEncryptedBackupFile()" style="background: #6c63ff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%;">
                        🔐 Download Encrypted Backup (.lbk)
                    </button>
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    Save securely offline. Prefer the encrypted backup on mobile.
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button onclick="confirmExportBackup()" style="background: #d32f2f; color: white; border: none; padding: 12px 30px; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    ✅ I've Saved My Keys Securely
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-clear sensitive data after 5 minutes for security
    setTimeout(() => {
        console.log('⏰ Auto-clearing sensitive data after timeout');
        clearSensitiveData();
    }, 5 * 60 * 1000); // 5 minutes
}

// Helper functions for export modal
function toggleKeyVisibility(elementId) {
    const element = document.getElementById(elementId);
    const button = element.nextElementSibling;
    
    if (element.type === 'password') {
        element.type = 'text';
        button.textContent = '🙈 Hide';
    } else {
        element.type = 'password';
        button.textContent = '👁️ Show';
    }
}

// Function to close export modal
function confirmCloseExport() {
    const confirmed = confirm('⚠️ Are you sure you want to close the export results?\n\nMake sure you have saved your private keys before closing.');
    if (confirmed) {
        // Clear sensitive data from memory
        clearSensitiveData();
        closeExportModal();
    }
}

function clearSensitiveData() {
    try {
        // Clear any sensitive data from memory
        const sensitiveElements = ['privateKeyDisplay', 'sAddressDisplay'];
        sensitiveElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });
        
        // Clear any stored variables
        if (window.currentExportData) {
            window.currentExportData = null;
        }
        
        console.log('🧹 Sensitive data cleared from memory');
    } catch (error) {
        console.error('Error clearing sensitive data:', error);
    }
}

function closeExportModal() {
    const modal = document.querySelector('div[style*="position: fixed"][style*="z-index: 10000"]');
    if (modal) {
        modal.remove();
        showStatus('Export modal closed', 'info');
    }
}

// Function to automatically clear cloud storage
async function autoClearCloudStorage() {
    try {
        // Add confirmation dialog to prevent accidental clearing
        const confirmed = confirm('⚠️ WARNING: This will permanently delete all your stored API keys and session data.\n\nThis action cannot be undone. Are you sure you want to continue?');
        if (!confirmed) {
            console.log('❌ Auto-clear cancelled by user');
            return;
        }
        
        console.log('🧹 Auto-clearing cloud storage...');
        
        // Clear all stored data
        await new Promise((resolve, reject) => {
            Telegram.WebApp.CloudStorage.removeItem('TURNKEY_API_KEY', (error) => {
                if (error) {
                    console.error('Error clearing TURNKEY_API_KEY:', error);
                    reject(error);
                } else {
                    console.log('✅ TURNKEY_API_KEY cleared');
                    resolve();
                }
            });
        });

        await new Promise((resolve, reject) => {
            Telegram.WebApp.CloudStorage.removeItem('ENCRYPTED_API_KEYS', (error) => {
                if (error) {
                    console.error('Error clearing ENCRYPTED_API_KEYS:', error);
                    reject(error);
                } else {
                    console.log('✅ ENCRYPTED_API_KEYS cleared');
                    resolve();
                }
            });
        });

        // Show success message
        document.getElementById('content').innerHTML = `
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>✅ Cloud Storage Cleared Successfully!</h3>
                <p>All stored API keys and session data have been removed from your Telegram Cloud Storage.</p>
                <p>You can now close this window and return to the bot.</p>
            </div>
        `;

        console.log('✅ Auto-clear completed successfully');
        
    } catch (error) {
        console.error('❌ Error during auto-clear:', error);
        document.getElementById('content').innerHTML = `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <h3>❌ Error Clearing Cloud Storage</h3>
                <p>There was an error clearing your stored data: ${error.message}</p>
                <p>You may need to manually clear your data later.</p>
            </div>
        `;
    }
}

// Make autoClearCloudStorage globally available
window.autoClearCloudStorage = autoClearCloudStorage;

// Function to copy text to clipboard (for direct text copying)
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showStatus('✅ Copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showStatus('❌ Copy failed', 'error');
    }
}

// Function to copy from input element (for element-based copying)
function copyElementToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Element not found:', elementId);
        return;
    }
    
    element.select();
    document.execCommand('copy');
    
    // Show feedback
    const button = element.parentElement.nextElementSibling;
    if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.background = '#4CAF50';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#4CAF50';
        }, 2000);
    }
}

function confirmExportBackup() {
    // Remove modal
    const modal = document.querySelector('div[style*="position: fixed"]');
    if (modal) modal.remove();
    
    showStatus('✅ Wallet backup completed! Keep your keys safe.', 'success');
    
    // Store confirmation in session
    sessionStorage.setItem('walletExported', 'true');
}

// Download backup file function
function downloadBackupFile() {
    try {
        // Get the export result from the modal
        const privateKeyInput = document.getElementById('privateKeyDisplay');
        const sAddressInput = document.getElementById('sAddressDisplay');
        
        if (!privateKeyInput || !sAddressInput) {
            throw new Error('Export data not found');
        }
        
        const stellarPrivateKey = privateKeyInput.value;
        const stellarSAddress = sAddressInput.value;
        
        // Get Stellar address from session or generate placeholder
        const stellarAddress = sessionStorage.getItem('stellarAddress') || 'GCRIE4GIELZQT6E2LWY7NIAG3WOEFA7ZV7ZVKKDON7XQ7AZJ37B3RFHI';
        
        // Create backup file content
        const backupContent = ExportUtils.createBackupFileContent(
            stellarPrivateKey,
            stellarSAddress,
            stellarAddress
        );
        
        // Download the file
        ExportUtils.downloadAsFile(backupContent, `lumenbro-wallet-backup-${Date.now()}.txt`);
        
        showStatus('✅ Backup file downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showStatus('❌ Download failed: ' + error.message, 'error');
    }
}

// Download encrypted backup file function
async function downloadEncryptedBackupFile() {
    try {
        const privateKeyInput = document.getElementById('privateKeyDisplay');
        const sAddressInput = document.getElementById('sAddressDisplay');
        if (!privateKeyInput || !sAddressInput) {
            throw new Error('Export data not found');
        }
        const stellarPrivateKey = privateKeyInput.value;
        const stellarSAddress = sAddressInput.value;
        const stellarAddress = sessionStorage.getItem('stellarAddress') || 'GCRIE4GIELZQT6E2LWY7NIAG3WOEFA7ZV7ZVKKDON7XQ7AZJ37B3RFHI';
        const ok = await ExportUtils.downloadEncryptedBackupFile(stellarPrivateKey, stellarSAddress, stellarAddress);
        if (ok) {
            showStatus('✅ Encrypted backup downloaded!', 'success');
        } else {
            showStatus('❌ Encrypted backup download cancelled or failed', 'error');
        }
    } catch (error) {
        console.error('Encrypted backup download error:', error);
        showStatus('❌ Encrypted backup failed: ' + error.message, 'error');
    }
}
