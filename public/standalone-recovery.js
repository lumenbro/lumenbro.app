// Standalone Recovery for users locked out of Telegram
// This runs in a regular web browser, not in Telegram WebApp context

let userOrgId = null;
let recoveryKeys = null;

function showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    // Show target step
    document.getElementById(`step${stepNumber}`).classList.add('active');
}

function showStep1() { showStep(1); }
function showStep3() { showStep(3); }

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

async function startRecovery() {
    const email = document.getElementById('email').value.trim();
    if (!email) {
        alert('Please enter your email address');
        return;
    }

    updateStatus('Starting recovery process...');
    
    try {
        // Generate uncompressed P-256 key pair for recovery
        const cryptoKeyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );
        
        // Export keys in proper format
        const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', cryptoKeyPair.publicKey);
        const targetPublicKey = Array.from(new Uint8Array(publicKeyBuffer))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
        
        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', cryptoKeyPair.privateKey);
        const targetPrivateKey = Array.from(new Uint8Array(privateKeyBuffer))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
        
        const targetKeyPair = {
            publicKey: targetPublicKey,
            privateKey: targetPrivateKey
        };
        
        recoveryKeys = targetKeyPair; // Store for later use
        console.log('Generated uncompressed P-256 key, length:', targetPublicKey.length / 2, 'bytes');
        
        // First, try to find the user's orgId by email
        // This requires a new backend endpoint to lookup orgId by email
        const lookupResponse = await fetch('/lookup-org-by-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (!lookupResponse.ok) {
            throw new Error('Email not found in our system');
        }
        
        const lookupData = await lookupResponse.json();
        userOrgId = lookupData.orgId;
        
        // Initiate OTP recovery
        const recoveryResponse = await fetch('/init-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (!recoveryResponse.ok) {
            const errorData = await recoveryResponse.json();
            throw new Error(errorData.error || 'Recovery initiation failed');
        }
        
        const recoveryData = await recoveryResponse.json();
        // Store OTP ID for verification step
        window.recoveryOtpId = recoveryData.otpId;
        window.recoveryOrgId = recoveryData.orgId;
        
        updateStatus('Recovery email sent!');
        showStep(2);
        
    } catch (error) {
        console.error('Recovery error:', error);
        document.getElementById('errorMessage').textContent = error.message;
        document.getElementById('stepError').classList.add('active');
        updateStatus('Error: ' + error.message);
    }
}

async function processRecovery() {
    const otpCode = document.getElementById('recoveryCode').value.trim();
    if (!otpCode) {
        alert('Please enter the 6-digit code from your email');
        return;
    }

    updateStatus('Verifying OTP code...');
    
    try {
        // Verify OTP code with Turnkey
        const verifyResponse = await fetch('/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                otpId: window.recoveryOtpId,
                otpCode: otpCode,
                targetPublicKey: recoveryKeys.publicKey,
                email: document.getElementById('email').value
            })
        });

        if (!verifyResponse.ok) {
            const errorData = await verifyResponse.json();
            throw new Error(errorData.error || 'OTP verification failed');
        }

        const verifyData = await verifyResponse.json();
        
        // Store recovery credentials for wallet access
        window.recoveryCredentials = verifyData;
        
        updateStatus('Recovery complete! You now have access to your wallet.');
        showStep(4);
        
    } catch (error) {
        console.error('Processing error:', error);
        document.getElementById('errorMessage').textContent = error.message;
        document.getElementById('stepError').classList.add('active');
        updateStatus('Error: ' + error.message);
    }
}

async function decryptRecoveryCode(encryptedCode, privateKey) {
    // This needs to implement the actual decryption logic
    // based on how Turnkey encrypts the recovery codes
    // For now, placeholder implementation
    try {
        // Convert base64 encrypted code to buffer
        const encryptedBuffer = Uint8Array.from(atob(encryptedCode), c => c.charCodeAt(0));
        
        // Use WebCrypto to decrypt with the private key
        // This is a simplified example - actual implementation depends on Turnkey's encryption
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" }, // or whatever algorithm Turnkey uses
            privateKey,
            encryptedBuffer
        );
        
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        throw new Error('Failed to decrypt recovery code. Please check the code and try again.');
    }
}

function showWallet() {
    updateStatus('Redirecting to web wallet...');
    // Redirect to a simple web wallet interface
    window.location.href = '/wallet.html?recovered=true';
}

function exportKeys() {
    updateStatus('Preparing key export...');
    // Show interface to export private keys
    alert('Key export functionality would be implemented here.\n\nThis would allow you to export your private keys to import into other wallets.');
}

function setupTelegram() {
    updateStatus('Setting up Telegram access...');
    // Guide user through setting up Telegram mini-app access again
    alert('Telegram setup would guide you through:\n\n1. Installing Telegram on new device\n2. Accessing the LumenBro bot\n3. Importing your recovered wallet');
}

function contactSupport() {
    updateStatus('Opening support...');
    window.open('mailto:support@lumenbro.com?subject=Wallet Recovery Issue', '_blank');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateStatus('Ready to recover your wallet');
    
    // Debug: Confirm functions are loaded
    console.log('Standalone recovery loaded. startRecovery available:', typeof window.startRecovery !== 'undefined');
    
    // Check if Turnkey is available
    if (!window.Turnkey) {
        updateStatus('Loading Turnkey SDK...');
        // Wait a bit and check again
        setTimeout(() => {
            if (!window.Turnkey) {
                document.getElementById('errorMessage').textContent = 'Turnkey SDK failed to load. Please refresh the page.';
                document.getElementById('stepError').classList.add('active');
            }
        }, 3000);
    }
});

// Make functions globally available
window.startRecovery = startRecovery;
window.showStep3 = showStep3;
window.processRecovery = processRecovery;
window.showWallet = showWallet;
window.exportKeys = exportKeys;
window.setupTelegram = setupTelegram;
window.contactSupport = contactSupport;
