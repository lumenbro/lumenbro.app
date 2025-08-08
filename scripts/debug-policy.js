// scripts/debug-policy.js - Standalone test for Turnkey createPolicy (new file)

require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

const client = turnkey.apiClient();

async function testCreatePolicy() {
  try {
    const testSubOrgId = '015db711-38ca-4fb9-a8ab-ec84d7d2cfb1';  // From your logs, replace with a test sub-org
    const backendApiKeyId = 'e59d203e-5a5b-4873-a44c-6cae9e5f4ca0';  // Hardcoded from logs

    const policyParams = {
      type: 'ACTIVITY_TYPE_CREATE_POLICY',
      timestampMs: String(Date.now()),
      organizationId: testSubOrgId,
      parameters: {
        name: "test-recovery-delegation",
        effect: "EFFECT_ALLOW",
        note: "Test policy for email auth delegation",
        consensus: {
          operator: "and",
          operands: [
            {
              operator: "==",
              operands: [
                { type: "string", value: "ACTIVITY_TYPE_EMAIL_AUTH" },
                { type: "template", template: "activityType" }
              ]
            },
            {
              operator: "==",
              operands: [
                { type: "string", value: backendApiKeyId },
                { type: "template", template: "authenticatorId" }
              ]
            }
          ]
        }
      }
    };

    console.log('Testing policy params:', JSON.stringify(policyParams, null, 2));
    const response = await client.createPolicy(policyParams);
    console.log('Success! Response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error creating policy:', error);
    if (error.details) console.log('Details:', JSON.stringify(error.details, null, 2));
  }
}

testCreatePolicy();
