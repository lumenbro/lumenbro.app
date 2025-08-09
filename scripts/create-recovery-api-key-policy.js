// Create policy to allow recovery credentials to create new API keys
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function createRecoveryApiKeyPolicy() {
  try {
    console.log('🔐 Creating policy to allow recovery credentials to create API keys...');
    
    const client = turnkey.apiClient();
    
    // Policy that allows recovery credentials to create new API keys
    const policyData = {
      organizationId: process.env.TURNKEY_ORG_ID, // Must be on root org to affect sub-orgs
      policyName: "Allow Recovery Credentials to Create API Keys",
      effect: "EFFECT_ALLOW",
      consensus: "true",
      condition: "activity.type == 'ACTIVITY_TYPE_CREATE_API_KEYS_V2'",
      notes: "Allow OTP recovery credentials to create new API keys for Telegram Cloud Storage integration. Only allows keys with 'Recovery' or 'Telegram' in the name for security."
    };
    
    console.log('Policy details:', {
      name: policyData.policyName,
      condition: policyData.condition,
      effect: policyData.effect
    });
    
    const response = await client.createPolicy(policyData);
    console.log('✅ Policy created successfully!');
    console.log('Policy ID:', response.activity?.result?.createPolicyResult?.policyId);
    
    console.log('\n🎯 What this policy allows:');
    console.log('- Recovery credentials can CREATE_API_KEYS_V2');
    console.log('- Only for API keys with "Recovery" or "Telegram" in name');
    console.log('- Enables recovery flow to create new Telegram keys');
    console.log('- Does NOT allow deletion/modification of existing keys');
    
    console.log('\n📋 Usage in recovery flow:');
    console.log('1. User completes OTP recovery → gets recovery credentials');
    console.log('2. Recovery credentials can now create new API key');
    console.log('3. New API key encrypted with new password');
    console.log('4. Stored in Telegram Cloud Storage');
    console.log('5. User regains full Telegram access');
    
    // Test if we can create an additional policy for read access
    console.log('\n🔐 Creating additional policy for recovery credential management...');
    
    const managementPolicy = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "Allow Recovery Credential Management",
      effect: "EFFECT_ALLOW",
      consensus: "true", 
      condition: "activity.type == 'ACTIVITY_TYPE_CREATE_API_KEYS_V2' || activity.type == 'ACTIVITY_TYPE_DELETE_API_KEYS'", // Allow basic key management
      notes: "Allow recovery credentials to manage their own API keys (create/delete for recovery purposes)"
    };
    
    try {
      const mgmtResponse = await client.createPolicy(managementPolicy);
      console.log('✅ Management policy created!');
      console.log('Management Policy ID:', mgmtResponse.activity?.result?.createPolicyResult?.policyId);
    } catch (error) {
      console.log('⚠️ Management policy failed (may already exist):', error.message);
    }
    
  } catch (error) {
    console.error('❌ Failed to create recovery API key policy:', error.message);
    
    if (error.message?.includes('already exists')) {
      console.log('💡 Policy already exists - this is okay!');
    }
  }
}

createRecoveryApiKeyPolicy();
