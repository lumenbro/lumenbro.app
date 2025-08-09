// Enable OTP Email Authentication feature on root organization
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function enableOTPFeature() {
  try {
    console.log('Enabling OTP Email Authentication feature...');
    
    const client = turnkey.apiClient();
    
    const result = await client.setOrganizationFeature({
      organizationId: process.env.TURNKEY_ORG_ID,
      name: "FEATURE_NAME_OTP_EMAIL_AUTH",
      value: "true"
    });
    
    console.log('✅ OTP Email Authentication feature enabled successfully!');
    console.log('Result:', result);
    
    // Also check current features
    console.log('\nChecking organization features...');
    const features = await client.getOrganization({
      organizationId: process.env.TURNKEY_ORG_ID
    });
    
    console.log('Organization features:', features.organization?.featureSet || 'No features found');
    
  } catch (error) {
    console.error('❌ Failed to enable OTP feature:', error);
    
    if (error.message?.includes('FEATURE_NAME_OTP_EMAIL_AUTH')) {
      console.log('\n💡 This might mean the feature is already enabled or not available for your plan.');
    }
  }
}

enableOTPFeature();
