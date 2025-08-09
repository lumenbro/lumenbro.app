// Create policy to enable OTP authentication
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function createOtpPolicy() {
  try {
    console.log('🔐 Creating OTP authentication policy...');
    
    const client = turnkey.apiClient();
    
    // Policy to allow OTP authentication for the organization
    const policyData = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "Allow OTP Email Authentication",
      effect: "EFFECT_ALLOW",
      consensus: "true", // Simple allow-all consensus
      condition: "activity.resource == \"AUTH\"",
      notes: "Allow OTP email authentication for recovery purposes"
    };
    
    console.log('Creating policy:', {
      name: policyData.policyName,
      effect: policyData.effect,
      condition: policyData.condition
    });
    
    const response = await client.createPolicy(policyData);
    console.log('✅ OTP policy created successfully:', {
      activityId: response.activity?.activityId,
      policyId: response.activity?.result?.createPolicyResult?.policyId
    });
    
    // Also try a more general auth policy
    console.log('\n🔐 Creating general auth policy...');
    const generalAuthPolicy = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "Allow Email Authentication",
      effect: "EFFECT_ALLOW", 
      consensus: "true", // Simple allow-all consensus
      condition: "activity.resource == \"AUTH\"",
      notes: "Allow email-based authentication methods"
    };
    
    const authResponse = await client.createPolicy(generalAuthPolicy);
    console.log('✅ General auth policy created:', {
      activityId: authResponse.activity?.activityId,
      policyId: authResponse.activity?.result?.createPolicyResult?.policyId
    });
    
  } catch (error) {
    console.error('❌ Failed to create OTP policy:', error.message);
    
    if (error.message?.includes('already exists')) {
      console.log('💡 Policy might already exist. This is okay.');
    } else if (error.message?.includes('consensus')) {
      console.log('💡 Try a simpler consensus rule.');
    }
  }
}

createOtpPolicy();
