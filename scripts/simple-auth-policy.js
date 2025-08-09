// Create simple auth policy with minimal conditions
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function createSimplePolicy() {
  try {
    console.log('🔐 Creating simple auth policy...');
    
    const client = turnkey.apiClient();
    
    // Try the most basic policy possible
    const basicPolicy = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "Basic Auth Policy",
      effect: "EFFECT_ALLOW",
      consensus: "true",
      condition: "true", // Allow everything
      notes: "Basic policy to allow authentication activities"
    };
    
    console.log('Creating basic policy:', basicPolicy);
    
    try {
      const response = await client.createPolicy(basicPolicy);
      console.log('✅ Basic policy created:', {
        activityId: response.activity?.activityId,
        policyId: response.activity?.result?.createPolicyResult?.policyId
      });
    } catch (error) {
      console.log('❌ Basic policy failed:', error.message);
    }
    
    // Try with minimal condition
    const minimalPolicy = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "OTP Auth Policy", 
      effect: "EFFECT_ALLOW",
      consensus: "true",
      condition: "true", // Simplest possible condition
      notes: "Allow OTP authentication for email recovery"
    };
    
    console.log('\n🔐 Creating minimal policy...');
    try {
      const response2 = await client.createPolicy(minimalPolicy);
      console.log('✅ Minimal policy created:', {
        activityId: response2.activity?.activityId,
        policyId: response2.activity?.result?.createPolicyResult?.policyId
      });
    } catch (error) {
      console.log('❌ Minimal policy failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Overall failure:', error.message);
  }
}

createSimplePolicy();
