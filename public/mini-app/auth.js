// public/mini-app/auth.js - Client-side registration (no WebAuthn)
window.register = async function () {
    try {
        // Get telegram_id from initData (secure)
        const telegram_id = telegramApp.initDataUnsafe.user.id;
        const referrer_id = params.get('referrer_id') || null;  // From query param

        // Prompt for email
        const email = prompt('Enter your email:') || 'unknown@lumenbro.com';

        // Generate P256 keypair for API keys (no WebAuthn)
        const keyPair = Turnkey.generateP256KeyPair();  // Assume available in SDK

        // Fetch sub-org from backend (send public key for root user API key)
        const response = await fetch('/mini-app/create-sub-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id,
                initData: telegramApp.initData,
                email,
                apiPublicKey: keyPair.publicKey,  // Send public for sub-org creation
                referrer_id
            })
        });
        if (!response.ok) throw new Error('Backend error: ' + response.statusText);
        const { subOrgId } = await response.json();

        // Create stamper and store PRIVATE key in Telegram Cloud
        const stamper = await Turnkey.TelegramCloudStorageStamper.create();
        await stamper.setAPIKey({ apiPublicKey: keyPair.publicKey, apiPrivateKey: keyPair.privateKey });

        // Create client and register user API keys (if needed; optional post-sub-org)
        const client = new Turnkey.TurnkeyBrowserClient({ baseUrl: "https://api.turnkey.com", stamper });
        await client.createUserApiKeys({ organizationId: subOrgId /* add params if needed */ });

        document.getElementById('content').innerHTML = 'Registration complete! API keys stored in Telegram Cloud.';
    } catch (error) {
        console.error(error);
        document.getElementById('content').innerHTML = 'Error: ' + error.message;
    }
};
