// public/mini-app/login.js - Client-side login
// Use global params from index.html – no local const

// orgId is global from index.html

async function createTelegramCloudStorageStamper() {
    // Implement or import from lib if needed
    return await Turnkey.TelegramCloudStorageStamper.create();
}

async function login() {
    try {
        const stamper = await createTelegramCloudStorageStamper();
        const apiKey = await stamper.getAPIKey();  // Retrieve stored keys

        const client = new Turnkey.TurnkeyBrowserClient({ baseUrl: "https://api.turnkey.com", stamper });

        // Generate ephemeral key for HPKE
        const ephemeralKeyPair = Turnkey.generateP256KeyPair(); // Assume method

        // Prepare body for createReadWriteSession
        const body = {
            organizationId: orgId,
            // Add other params like userId, etc.
        };
        const bodyStr = JSON.stringify(body);

        // Stamp the request (assume stamper.stamp for WebAuthn stamp)
        const stamp = await stamper.stamp(bodyStr, 'webauthn'); // Adjust based on SDK

        // Send to backend proxy
        const response = await fetch('/mini-app/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: bodyStr, stamp, ephemeralPrivateKey: ephemeralKeyPair.privateKey })
        });
        if (!response.ok) throw new Error('Backend error');

        document.getElementById('content').innerHTML = 'Session started! Temp keys stored.';
    } catch (error) {
        console.error(error);
        document.getElementById('content').innerHTML = 'Error: ' + error.message;
    }
}
