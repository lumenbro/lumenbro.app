const { TurnkeyClient } = require('@turnkey/sdk-server');
const { ApiKeyStamper } = require('@turnkey/api-key-stamper');

const stamper = new ApiKeyStamper({
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY
});

module.exports = new TurnkeyClient({ baseUrl: 'https://api.turnkey.com' }, stamper);
