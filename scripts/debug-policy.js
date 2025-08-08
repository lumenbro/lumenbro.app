// scripts/debug-policy.js - Raw axios for create_policies

require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

const client = turnkey.apiClient();

async function testCreatePolicies() {
  try {
    const testSubOrgId = '015db711-38ca-4fb9-a8ab-ec84d7d2cfb1';
    const backendApiKeyId = '5f96d6f9-f95c-4b6a-aa2e-e51f224dc4ce';

    const params = {
      type: 'ACTIVITY_TYPE_CREATE_POLICIES',
      timestampMs: String(Date.now()),
      organizationId: testSubOrgId,
      parameters: {
        policies: [
          {
            policyName: "test-recovery-delegation",
            effect: "EFFECT_ALLOW",
            notes: "Test policy for email auth delegation",
            condition: `activityType == "ACTIVITY_TYPE_EMAIL_AUTH" && authenticatorId == "${backendApiKeyId}"`,
            consensus: `approvalCount == 1`
          }
        ]
      }
    };

    console.log('Testing params:', JSON.stringify(params, null, 2));
    const response = await client.createPolicies(params);
    console.log('Success! Response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error:', error);
    if (error.details) console.log('Details:', JSON.stringify(error.details, null, 2));
  }
}

testCreatePolicies();
