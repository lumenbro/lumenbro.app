// public/mini-app/clear.js - Client-side unregister/clear
window.unregister = async function () {
    try {
        // Clear Telegram Cloud Storage key
        await new Promise((resolve, reject) => {
            Telegram.WebApp.CloudStorage.removeItem('TURNKEY_API_KEY', (error) => {
                if (error) {
                    console.error('Error clearing cloud storage:', error);
                    reject(error);
                } else {
                    console.log('TURNKEY_API_KEY cleared from cloud storage');
                    resolve();
                }
            });
        });

        // Optionally clear backend DB state (if you have an endpoint like /mini-app/clear)
        const response = await fetch('/mini-app/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: Telegram.WebApp.initDataUnsafe.user.id })  // Send ID for DB clear
        });
        if (!response.ok) throw new Error('Backend clear failed');

        document.getElementById('content').innerHTML = 'Unregistered! Cloud storage and DB cleared.';
    } catch (error) {
        console.error(error);
        document.getElementById('content').innerHTML = 'Error: ' + error.message;
    }
};
