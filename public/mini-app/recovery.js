// public/mini-app/recovery.js - Client-side recovery (new file)
const telegramApp = window.Telegram.WebApp;
const params = new URLSearchParams(window.location.search);
const orgId = params.get('orgId'); // Assume passed

async function recover() {
    try {
        const email = prompt('Enter your email for recovery:');

        // Generate target public key for recovery (e.g., new passkey public key)
        const targetKeyPair = Turnkey.generateP256KeyPair();
        const targetPublicKey = targetKeyPair.publicKey;

        // Init recovery via backend
        const initResponse = await fetch('/mini-app/init-recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, email, targetPublicKey })
        });
        if (!initResponse.ok) throw new Error('Init recovery failed');

        // Assume further steps like completing recovery with email link, then notify
        // For simplicity, assume client handles notify if needed

        document.getElementById('content').innerHTML = 'Recovery initiated. Check your email.';
    } catch (error) {
        console.error(error);
        document.getElementById('content').innerHTML = 'Error: ' + error.message;
    }
}
