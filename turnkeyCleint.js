const { Turnkey } = require('@turnkey/sdk-server');

const client = new Turnkey({
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  baseUrl: 'https://api.turnkey.com/public/v1'
});

async function turnkeyRequest(endpoint, method = 'POST', data = null) {
  if (method.toUpperCase() !== 'POST') {
    throw new Error('Only POST method is supported for Turnkey activities');
  }
  try {
    // Use createActivity for 4.2.2 compatibility
    const response = await client.createActivity({
      type: data.type,
      organizationId: data.organizationId,
      parameters: data.parameters,
      timestampMs: data.timestampMs
    });
    console.log('Turnkey response (createActivity):', JSON.stringify(response, null, 2));
    return response;
  } catch (e) {
    console.error('Turnkey request failed:', e.message);
    throw e;
  }
}

module.exports = turnkeyRequest;
