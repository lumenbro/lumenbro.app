// public/mini-app/login.js - Client-side login
// Use global params from index.html – no local const

// Helper functions
function hexToUint8Array(hex) {
  if (!hex) throw new Error('Hex string is undefined or empty');
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function stringifySorted(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }
  return '{' + Object.keys(obj).sort().map(key => {
    return JSON.stringify(key) + ':' + stringifySorted(obj[key]);
  }).join(',') + '}';
}

function bytesToBase64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(privateHex, publicCompressedHex) {
  const publicBytes = hexToUint8Array(publicCompressedHex);
  const publicKeyCrypto = await crypto.subtle.importKey(
    "raw",
    publicBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", publicKeyCrypto);

  const privateBytes = hexToUint8Array(privateHex);
  const d = bytesToBase64url(privateBytes);

  const privateJwk = {
    kty: "EC",
    crv: "P-256",
    d,
    x: publicJwk.x,
    y: publicJwk.y
  };

  return await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

function derEncodeSignature(sigBuffer) {
  const sigBytes = new Uint8Array(sigBuffer);
  const rBytes = sigBytes.slice(0, 32);
  let s = BigInt('0x' + arrayBufferToHex(sigBytes.slice(32)));
  const n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  if (s > n / 2n) {
    s = n - s;
  }
  const sHex = s.toString(16).padStart(64, '0');
  const sBytes = hexToUint8Array(sHex);

  let r = [...rBytes];
  let sArr = [...sBytes];
  if (r[0] > 127) r = [0, ...r];
  if (sArr[0] > 127) sArr = [0, ...sArr];

  const rLen = r.length;
  const sLen = sArr.length;
  const totalLen = 2 + rLen + 2 + sLen;
  const der = new Uint8Array(2 + totalLen);
  der[0] = 0x30;
  der[1] = totalLen;
  der[2] = 0x02;
  der[3] = rLen;
  der.set(r, 4);
  der[4 + rLen] = 0x02;
  der[5 + rLen] = sLen;
  der.set(sArr, 6 + rLen);
  return arrayBufferToHex(der);
}

async function createTelegramCloudStorageStamper() {
  const stamper = await Turnkey.TelegramCloudStorageStamper.create();
  console.log('Stamper initialized'); // Debug
  return stamper;
}

async function login() {
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get('orgId');
  const email = urlParams.get('email');
  const telegramId = urlParams.get('telegram_id');

  if (!orgId) {
    document.getElementById('content').innerHTML = 'Error: Missing orgId parameter';
    return;
  }

  try {
    const stamper = await createTelegramCloudStorageStamper();
    // NEW: Instead of direct getAPIKey, retrieve and decrypt
    const encryptedData = await new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('TURNKEY_API_KEY', (error, value) => {
        resolve(value ? JSON.parse(value) : null);
      });
    });
    if (!encryptedData) throw new Error('No stored key found');

    const password = prompt('Enter your password to decrypt key:');
    if (!password) throw new Error('Password required');

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: Uint8Array.from(encryptedData.salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const decryptedPrivateKeyBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(encryptedData.iv) },
      derivedKey,
      Uint8Array.from(encryptedData.encryptedPrivateKey)
    );
    const decryptedPrivateKey = new TextDecoder().decode(decryptedPrivateKeyBuffer);

    const apiKey = {
      apiPublicKey: encryptedData.publicKey,
      apiPrivateKey: decryptedPrivateKey
    };

    console.log('Retrieved API key:', apiKey); // Debug

    if (!apiKey || !apiKey.apiPublicKey || !apiKey.apiPrivateKey) {
      throw new Error('Failed to retrieve valid API key from Telegram Cloud Storage');
    }

    // REMOVED: Hardcoded public key validation
    // const expectedPublicKey = '023dca6fc4a0b275e19c1c6caac0c6ce8efb70461ffe6a1e360d10b725794811e3';
    // if (apiKey.apiPublicKey !== expectedPublicKey) {
    //   throw new Error(`API public key mismatch: got ${apiKey.apiPublicKey}, expected ${expectedPublicKey}`);
    // }

    // REPLACED with optional format validation:
    if (!apiKey.apiPublicKey || !apiKey.apiPrivateKey) {
      throw new Error('Invalid API key format');
    }

    // Fetch userId from backend
    const userIdResponse = await fetch(`/get-user-id?orgId=${orgId}`);
    if (!userIdResponse.ok) throw new Error('Failed to fetch userId');
    const { userId } = await userIdResponse.json();

    // Fetch email from backend
    let email;
    const emailResponse = await fetch(`/get-user-email?orgId=${orgId}`);
    if (!emailResponse.ok) {
      console.warn('Email fetch failed, using fallback');
      email = 'bpeterscqa@gmail.com';
    } else {
      const emailData = await emailResponse.json() || { email: 'bpeterscqa@gmail.com' };
      email = emailData.email;
    }

    // Generate ephemeral key for HPKE
    const ephemeralKeyPair = await Turnkey.generateP256EphemeralKeyPair();
    if (!ephemeralKeyPair.uncompressedPublic) {
      throw new Error('Ephemeral keypair missing uncompressedPublic');
    }
    console.log('Ephemeral keypair:', ephemeralKeyPair); // Debug

    // Prepare body for createReadWriteSession (V2 structure)
    const body = {
      type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
      timestampMs: String(Date.now()),
      organizationId: orgId,
      email,
      parameters: {
        userId,
        expirationSeconds: "7776000",
        targetPublicKey: ephemeralKeyPair.uncompressedPublic,
        apiKeyName: `Read Write Session - ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
        invalidateExisting: true
      }
    };
    const bodyStr = stringifySorted(body);
    console.log('Sent body:', bodyStr);

    // Sign the bodyStr using stored API private key
    const privateKeyCrypto = await importPrivateKey(apiKey.apiPrivateKey, apiKey.apiPublicKey);
    const sigBuffer = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKeyCrypto,
      new TextEncoder().encode(bodyStr)
    );
    const sigHex = derEncodeSignature(sigBuffer);

    // Create stamp object
    const stamp = {
      publicKey: apiKey.apiPublicKey,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature: sigHex
    };
    const stampJson = stringifySorted(stamp);
    const stampEncoded = btoa(stampJson)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    console.log('Generated stamp:', stampEncoded);

    // Send to backend proxy
    const response = await fetch('/mini-app/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: bodyStr,
        stamp: stampEncoded,
        ephemeralPrivateKey: ephemeralKeyPair.privateKey,
        initData: window.Telegram.WebApp.initData
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${errorText}`);
    }

    document.getElementById('content').innerHTML = 'Session started! Temp keys stored.';
  } catch (error) {
    console.error('Login error:', error);
    document.getElementById('content').innerHTML = 'Error: ' + error.message;
  }
};
