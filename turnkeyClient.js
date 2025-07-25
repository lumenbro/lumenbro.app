const { Turnkey } = require('@turnkey/sdk-server');

const client = new Turnkey({
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  apiBaseUrl: 'https://api.turnkey.com'
}).apiClient();

async function turnkeyRequest(activityType, data) {
  try {
    let response;
    if (activityType === 'INIT_USER_EMAIL_RECOVERY') {
      response = await client.initUserEmailRecovery(data);
    } else {
      throw new Error(`Unsupported activity type: ${activityType}`);
    }
    console.log('Turnkey response:', JSON.stringify(response, null, 2));
    return response;
  } catch (e) {
    console.error('Turnkey request failed:', e.message);
    throw e;
  }
}

module.exports = turnkeyRequest;
