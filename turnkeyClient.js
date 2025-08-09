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
  createReadWriteSession: async (data) => await client.createReadWriteSession(data),
  // Modern OTP-based Email Auth methods
  initOtpAuth: async (params) => await client.initOtpAuth(params),
  otpAuth: async (params) => await client.otpAuth(params),
  // Legacy Email Auth (keeping for backward compatibility)
  emailAuth: async (params) => await client.emailAuth(params),
  getApiKeys: async (params) => await client.getApiKeys(params),
  getWhoami: async (params) => await client.getWhoami(params),
  createPolicy: async (params) => await client.createPolicy(params),
  // Add if needed for completion (client-side will handle addAuthenticator)
  addAuthenticator: async (params) => await client.addAuthenticator(params),
  deletePolicies: async (params) => await client.deletePolicies(params),
};
