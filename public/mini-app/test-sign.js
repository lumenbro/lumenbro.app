// public/mini-app/test-sign.js - Test transaction signing (new file)

async function testSignTransaction() {
  try {
    // Use stamper from login or recreate
    const stamper = /* get from login global or recreate with decrypted key */;
    const orgId = '861dcf9d-156d-4559-a548-719a76a3ff99';  // From your logs
    const walletKeyId = 'de820488-254b-535a-bc83-43d0c27b0290';  // From logs
    const testTx = 'AAAAAgAAAAD...base64encodedtesttx';  // Generate a real base64 Stellar TX (use Stellar SDK for no-op)

    const signParams = {
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
      organizationId: orgId,
      timestampMs: String(Date.now()),
      parameters: {
        signWith: walletKeyId,
        transaction: testTx,
        type: "TRANSACTION_TYPE_STELLAR"
      }
    };

    // Sign and send to Turnkey (or backend proxy)
    const response = await fetch('/mini-app/sign-transaction', {  // Add this endpoint if needed
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signParams)
    });
    const result = await response.json();
    console.log('Sign result:', result);
  } catch (error) {
    console.error('Sign error:', error);
  }
}

// Call after login: testSignTransaction();
