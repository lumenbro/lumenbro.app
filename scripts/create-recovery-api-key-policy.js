#!/usr/bin/env node
require('dotenv').config();

const { Turnkey } = require('@turnkey/sdk-server');

async function createRecoveryApiKeyPolicy() {
  try {
    const turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
      defaultOrganizationId: process.env.TURNKEY_ORG_ID
    });
    
    const client = turnkey.apiClient();
    
    console.log('🔑 Creating policy to allow recovery credentials to create API keys...');
    
    const policyData = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "Allow Recovery Credentials to Create API Keys",
      effect: "EFFECT_ALLOW",
      consensus: "approvers.count == 1",
      condition: "activity.type == 'ACTIVITY_TYPE_CREATE_API_KEYS_V2'",
      notes: "Allow recovery session credentials to create new API keys for Telegram access"
    };
    
    console.log('Policy data:', JSON.stringify(policyData, null, 2));
    
    const response = await client.createPolicy(policyData);
    
    console.log('✅ Policy created successfully:', response);
    console.log('Policy ID:', response.activity?.result?.createPolicyResult?.policyId);
    
  } catch (error) {
    console.error('❌ Failed to create recovery API key policy:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

createRecoveryApiKeyPolicy();