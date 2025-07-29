// public/mini-app/auth.js - Client-side registration (no WebAuthn)
window.register = async function () {
    try {
        if (!window.Turnkey || !window.Turnkey.generateP256KeyPair) {
            console.error('Turnkey bundle not loaded or generateP256KeyPair missing. Check Network tab for /static/turnkey.min.js load (200 OK). Rebuild bundle and ensure path in index.html.');
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

        // Generate P256 keypair for API keys (no WebAuthn)
        const keyPair = await window.Turnkey.generateP256KeyPair();

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
        const { subOrgId } = await response.json();

        // Create stamper and store PRIVATE key in Telegram Cloud
        const stamper = await window.Turnkey.TelegramCloudStorageStamper.create({
            cloudStorageAPIKey: {
                apiPublicKey: keyPair.publicKey,
                apiPrivateKey: keyPair.privateKey
            }
        });

        document.getElementById('content').innerHTML = 'Registration complete! API keys stored in Telegram Cloud.';
    } catch (error) {
        console.error(error);
        document.getElementById('content').innerHTML = 'Error: ' + error.message;
    }
};
