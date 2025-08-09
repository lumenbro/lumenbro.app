// Check available features and try to enable OTP
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function checkFeatures() {
  try {
    const client = turnkey.apiClient();
    
    console.log('Checking organization features...');
    const org = await client.getOrganization({
      organizationId: process.env.TURNKEY_ORG_ID
    });
    
    console.log('Organization:', {
      name: org.organization?.organizationName,
      id: org.organization?.organizationId,
      features: org.organization?.featureSet
    });
    
    // Try different feature names
    const featureNames = [
      "FEATURE_NAME_OTP_EMAIL_AUTH",
      "OTP_EMAIL_AUTH", 
      "EMAIL_AUTH",
      "FEATURE_NAME_EMAIL_AUTH"
    ];
    
    for (const featureName of featureNames) {
      try {
        console.log(`\nTrying to enable: ${featureName}`);
        await client.setOrganizationFeature({
          organizationId: process.env.TURNKEY_ORG_ID,
          name: featureName,
          value: "true"
        });
        console.log(`✅ Successfully enabled: ${featureName}`);
        break;
      } catch (error) {
        console.log(`❌ Failed: ${featureName} - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking features:', error);
  }
}

checkFeatures();

