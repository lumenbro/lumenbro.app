const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID  // Optional but recommended for root org calls
});

module.exports = turnkey;
