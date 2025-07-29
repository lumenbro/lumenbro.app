console.log('turnkey-entry.js starting...');

(async () => {
  try {
    const TurnkeyBrowserClient = (await import('@turnkey/sdk-browser')).TurnkeyBrowserClient;
    const IframeStamper = (await import('@turnkey/iframe-stamper')).IframeStamper;
    const getWebAuthnAttestation = (await import('@turnkey/http')).getWebAuthnAttestation;
    const TelegramCloudStorageStamper = (await import('@turnkey/telegram-cloud-storage-stamper')).TelegramCloudStorageStamper;

    window.Turnkey = {
      TurnkeyBrowserClient,
      IframeStamper,
      getWebAuthnAttestation,
      TelegramCloudStorageStamper,  // Expose the class (use TelegramCloudStorageStamper.create() in client code)
      generateP256KeyPair: async () => {  // Native Web Crypto
        const keyPair = await crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify']
        );
        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const publicKeyHex = Array.from(new Uint8Array(publicKeyRaw)).map(b => b.toString(16).padStart(2, '0')).join('');
        const privateKeyHex = Array.from(new Uint8Array(privateKeyRaw)).map(b => b.toString(16).padStart(2, '0')).join('');
        return { publicKey: publicKeyHex, privateKey: privateKeyHex };
      }
    };
    console.log('turnkey-entry.js finished – window.Turnkey set.');
  } catch (error) {
    console.error('Error in turnkey-entry.js:', error);
  }
})();
