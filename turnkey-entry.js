// turnkey-entry.js
console.log('turnkey-entry.js starting...');

(async () => {
  try {
    const { TurnkeyBrowserClient } = await import('@turnkey/sdk-browser');
    const { IframeStamper } = await import('@turnkey/iframe-stamper');
    const { getWebAuthnAttestation } = await import('@turnkey/http');
    const { TelegramCloudStorageStamper } = await import('@turnkey/telegram-cloud-storage-stamper');

    // Initialize base object
    window.Turnkey = {
      TurnkeyBrowserClient,
      IframeStamper,
      getWebAuthnAttestation,
             TelegramCloudStorageStamper,
       // Key generation methods
       generateP256KeyPair: async () => {
         // Import the key generation function from the Turnkey crypto package
         const { generateP256KeyPair } = await import('@turnkey/crypto');
         return generateP256KeyPair();
       },
              // Decryption methods
        decryptExportBundle: async ({ exportBundle, privateKey, organizationId }) => {
         // Import the decryption function from the Turnkey crypto package
         const { decryptExportBundle } = await import('@turnkey/crypto');
         return await decryptExportBundle({ 
           exportBundle, 
           embeddedKey: privateKey,
           organizationId: organizationId,
           keyFormat: "HEXADECIMAL"
         });
       },
      // For persistent API keys (ECDSA for signing)
      generateP256ApiKeyPair: async () => {
        const keyPair = await crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify']
        );

        const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

        const xHex = base64urlToHex(publicJwk.x).padStart(64, '0');
        const yHex = base64urlToHex(publicJwk.y).padStart(64, '0');

        const yLastByte = parseInt(yHex.slice(-2), 16);
        const prefix = yLastByte % 2 === 0 ? '02' : '03';
        const publicHex = prefix + xHex;

        const privateHex = base64urlToHex(privateJwk.d).padStart(64, '0');

        console.log('Generated API keyPair:', { publicKey: publicHex, privateKey: privateHex });
        return { publicKey: publicHex, privateKey: privateHex };
      },
      // For ephemeral keys (ECDH for HPKE decryption)
      generateP256EphemeralKeyPair: async () => {
        const keyPair = await crypto.subtle.generateKey(
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey', 'deriveBits']
        );

        const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

        const xHex = base64urlToHex(publicJwk.x).padStart(64, '0');
        const yHex = base64urlToHex(publicJwk.y).padStart(64, '0');

        const yLastByte = parseInt(yHex.slice(-2), 16);
        const prefix = yLastByte % 2 === 0 ? '02' : '03';
        const publicHex = prefix + xHex;

        const uncompressedPublic = '04' + xHex + yHex;

        const privateHex = base64urlToHex(privateJwk.d).padStart(64, '0');

        console.log('Generated ephemeral keyPair:', { publicKey: publicHex, privateKey: privateHex, uncompressedPublic });
        return { publicKey: publicHex, privateKey: privateHex, uncompressedPublic };
      }
    };

    function base64urlToHex(base64url) {
      let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binary = atob(base64);
      let hex = '';
      for (let i = 0; i < binary.length; i++) {
        hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return hex;
    }

    console.log('turnkey-entry.js finished – window.Turnkey set.');
  } catch (error) {
    console.error('Error in turnkey-entry.js:', error);
  }
})();
