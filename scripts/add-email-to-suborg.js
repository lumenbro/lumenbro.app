// Try to add email to existing sub-org user
require('dotenv').config();
const { Turnkey } = require('@turnkey/sdk-server');

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID
});

async function addEmailToSubOrg() {
  try {
    const testEmail = 'bpeterscqa@gmail.com';
    const subOrgId = 'f6b61722-c370-4a08-969b-04c00fe469ec';
    
    console.log('🔧 Attempting to add email to existing sub-org...');
    console.log(`📧 Email: ${testEmail}`);
    console.log(`🏢 Sub-org: ${subOrgId}`);
    
    const client = turnkey.apiClient();
    
    // First, let's see what users exist in the sub-org
    console.log('\n👥 Checking current sub-org users...');
    try {
      const orgInfo = await client.getOrganization({
        organizationId: subOrgId
      });
      
      console.log('Sub-org info:', {
        name: orgInfo.organization?.organizationName,
        users: orgInfo.organization?.rootUsers?.length || 0
      });
      
      if (orgInfo.organization?.rootUsers?.length > 0) {
        const user = orgInfo.organization.rootUsers[0];
        console.log('Current user:', {
          userName: user.userName,
          userEmail: user.userEmail,
          userId: user.userId
        });
        
        if (!user.userEmail) {
          console.log('\n❌ User missing userEmail field - this is the problem!');
          console.log('💡 Recommendation: Re-register with updated auth.js');
          console.log('💡 Alternative: Try to update the user (if Turnkey supports it)');
        } else {
          console.log('✅ User already has userEmail - OTP should work');
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to get sub-org info:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Overall error:', error.message);
  }
}

addEmailToSubOrg();

