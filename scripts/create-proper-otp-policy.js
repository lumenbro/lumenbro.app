// Create properly scoped OTP policy
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function createProperOtpPolicy() {
  try {
    console.log('🔐 Creating properly scoped OTP policy...');
    
    const client = turnkey.apiClient();
    
    // Specific OTP authentication policy
    const otpPolicy = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "OTP Authentication Policy",
      effect: "EFFECT_ALLOW",
      consensus: "true",
      condition: "activity.type == 'ACTIVITY_TYPE_INIT_OTP_AUTH' || activity.type == 'ACTIVITY_TYPE_OTP_AUTH'",
      notes: "Allow OTP initialization and verification for email recovery"
    };
    
    console.log('Creating OTP policy:', {
      name: otpPolicy.policyName,
      condition: otpPolicy.condition
    });
    
    const response = await client.createPolicy(otpPolicy);
    console.log('✅ OTP policy created:', {
      activityId: response.activity?.activityId,
      policyId: response.activity?.result?.createPolicyResult?.policyId
    });
    
    // Also create a policy for general email auth (backward compatibility)
    console.log('\n🔐 Creating email auth policy...');
    const emailAuthPolicy = {
      organizationId: process.env.TURNKEY_ORG_ID,
      policyName: "Email Authentication Policy",
      effect: "EFFECT_ALLOW",
      consensus: "true", 
      condition: "activity.type == 'ACTIVITY_TYPE_EMAIL_AUTH' || activity.type == 'ACTIVITY_TYPE_EMAIL_AUTH_V2'",
      notes: "Allow email authentication for recovery (legacy and modern)"
    };
    
    const emailResponse = await client.createPolicy(emailAuthPolicy);
    console.log('✅ Email auth policy created:', {
      activityId: emailResponse.activity?.activityId,
      policyId: emailResponse.activity?.result?.createPolicyResult?.policyId
    });
    
    console.log('\n📋 Summary:');
    console.log('- OTP Policy: Allows INIT_OTP_AUTH and OTP_AUTH activities');
    console.log('- Email Auth Policy: Allows EMAIL_AUTH activities');
    console.log('- Previous broad "true" policy can be deleted for security');
    
  } catch (error) {
    console.error('❌ Failed to create proper OTP policy:', error.message);
    
    if (error.message?.includes('already exists')) {
      console.log('💡 Policy with this name already exists.');
    }
  }
}

createProperOtpPolicy();

