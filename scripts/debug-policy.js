// scripts/debug-policy.js - Raw axios for create_policies

import dotenv from 'dotenv';
dotenv.config();
import { Turnkey } from '@turnkey/sdk-server';

const rootOrgId = process.env.TURNKEY_ORG_ID;
const backendApiKeyId = '5f96d6f9-f95c-4b6a-aa2e-e51f224dc4ce';  // Your actual backend API key ID

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

const client = turnkey.apiClient();

async function testCreatePolicies() {
  // Test wrapped (AI suggestion)
  const wrappedParams = {
    type: 'ACTIVITY_TYPE_CREATE_POLICIES',
    timestampMs: String(Date.now()),
    organizationId: rootOrgId,
    parameters: {
      policies: [
        {
          policyName: 'global-recovery-delegation-wrapped',
          effect: 'EFFECT_ALLOW',
          notes: 'Test policy for email auth recovery',
          condition: `activity.type == 'ACTIVITY_TYPE_EMAIL_AUTH'`,
          consensus: 'true'
        }
      ]
    }
  };

  console.log('Testing wrapped structure with params:', JSON.stringify(wrappedParams, null, 2));

  try {
    const wrappedResponse = await client.createPolicies(wrappedParams);
    console.log('Success for wrapped! Response:', JSON.stringify(wrappedResponse, null, 2));
  } catch (error) {
    console.error('Error for wrapped:', error.message, '\nDetails:', error.details || []);
  }

  // Test top-level (previous successful format)
  const topLevelParams = {
    type: 'ACTIVITY_TYPE_CREATE_POLICIES',
    timestampMs: String(Date.now()),
    organizationId: rootOrgId,
    policies: [
      {
        policyName: 'global-recovery-delegation-top',
        effect: 'EFFECT_ALLOW',
        notes: 'Test policy for email auth recovery',
        condition: `activity.type == 'ACTIVITY_TYPE_EMAIL_AUTH'`,
        consensus: 'true'
      }
    ]
  };

  console.log('Testing top-level structure with params:', JSON.stringify(topLevelParams, null, 2));

  try {
    const topResponse = await client.createPolicies(topLevelParams);
    console.log('Success for top-level! Response:', JSON.stringify(topResponse, null, 2));
  } catch (error) {
    console.error('Error for top-level:', error.message, '\nDetails:', error.details || []);
  }
}

// New function to list policies
async function listPolicies() {
  try {
    const response = await client.getPolicies({ organizationId: rootOrgId });
    console.log('Existing policies:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error listing policies:', error.message, '\nDetails:', error.details || []);
  }
}

// Then create final
const finalParams = {
  type: 'ACTIVITY_TYPE_CREATE_POLICIES',
  timestampMs: String(Date.now()),
  organizationId: rootOrgId,
  policies: [
    {
      policyName: 'global-recovery-delegation-secure',
      effect: 'EFFECT_ALLOW',
      notes: 'Allow only backend key to initiate email auth recovery for sub-orgs',
      condition: `activity.type == 'ACTIVITY_TYPE_EMAIL_AUTH' && activity.intent.emailAuthIntent.authenticatorId == '${backendApiKeyId}'`,
      consensus: 'approvers.count == 1'
    }
  ]
};

console.log('Creating final policy with params:', JSON.stringify(finalParams, null, 2));

try {
  const finalResponse = await client.createPolicies(finalParams);
  console.log('Success for final policy! Response:', JSON.stringify(finalResponse, null, 2));
} catch (error) {
  console.error('Error for final policy:', error.message, '\nDetails:', error.details || []);
}

// Call after tests
testCreatePolicies();
listPolicies();

const v3Params = {
  type: 'ACTIVITY_TYPE_CREATE_POLICIES',
  timestampMs: String(Date.now()),
  organizationId: rootOrgId,
  policies: [
    {
      policyName: 'global-recovery-delegation-v3',
      effect: 'EFFECT_ALLOW',
      notes: 'Test with activity.authenticatorId',
      condition: `activity.type == 'ACTIVITY_TYPE_EMAIL_AUTH' && activity.authenticatorId == '${backendApiKeyId}'`,
      consensus: 'true'
    }
  ]
};

console.log('Testing v3 with params:', JSON.stringify(v3Params, null, 2));

try {
  const v3Response = await client.createPolicies(v3Params);
  console.log('Success for v3! Response:', JSON.stringify(v3Response, null, 2));
} catch (error) {
  console.error('Error for v3:', error.message, '\nDetails:', error.details || []);
}

// listPolicies();
