// turnkeyClient.js - Wrapper for Turnkey SDK server client with typed methods
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

const client = turnkey.apiClient();

module.exports = {
  createSubOrganization: async (params) => await client.createSubOrganization(params),
  initUserEmailRecovery: async (data) => await client.initUserEmailRecovery(data),
  createReadWriteSession: async (data) => await client.createReadWriteSession(data),
  // Add more typed methods as needed, e.g., for other activities
};
