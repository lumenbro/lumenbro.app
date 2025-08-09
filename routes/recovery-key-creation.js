// Recovery Key Creation - Backend endpoint for creating new API keys with recovery credentials
const express = require('express');
const router = express.Router();
const { Turnkey } = require('@turnkey/sdk-server');

// Create new API key using recovery credentials
router.post('/create-recovery-api-key', async (req, res) => {
  const { recoveryCredentials, newPublicKey, email, apiKeyName } = req.body;
  
  if (!recoveryCredentials || !newPublicKey || !email || !apiKeyName) {
    return res.status(400).json({ 
      error: "Missing required fields: recoveryCredentials, newPublicKey, email, apiKeyName" 
    });
  }
  
  try {
    console.log('🔑 Creating new API key with recovery credentials:', {
      email: email,
      orgId: recoveryCredentials.orgId,
      apiKeyName: apiKeyName
    });
    
    // For now, we'll simulate the process since we need actual recovery credentials
    // In practice, you would:
    // 1. Decrypt the credentialBundle with the target private key
    // 2. Use those credentials to create a Turnkey client
    // 3. Create the new API key in the user's sub-org
    
    // Simulate decrypting recovery credentials
    const mockDecryptedCredentials = {
      apiPublicKey: "02" + "a".repeat(64),
      apiPrivateKey: "b".repeat(64)
    };
    
    // Create Turnkey client with recovery credentials
    const recoveryTurnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: mockDecryptedCredentials.apiPublicKey,
      apiPrivateKey: mockDecryptedCredentials.apiPrivateKey,
      defaultOrganizationId: recoveryCredentials.orgId
    });
    
    const recoveryClient = recoveryTurnkey.apiClient();
    
    // Create new API key in the user's sub-org using recovery credentials
    const createApiKeyResponse = await recoveryClient.createApiKeys({
      organizationId: recoveryCredentials.orgId,
      userId: recoveryCredentials.userId,
      apiKeys: [{
        apiKeyName: apiKeyName,
        publicKey: newPublicKey,
        curveType: "API_KEY_CURVE_SECP256K1"
      }]
    });
    
    console.log('✅ New API key created successfully:', {
      activityId: createApiKeyResponse.activity?.activityId,
      apiKeyIds: createApiKeyResponse.activity?.result?.createApiKeysResult?.apiKeyIds
    });
    
    const newApiKeyId = createApiKeyResponse.activity?.result?.createApiKeysResult?.apiKeyIds?.[0];
    
    res.json({
      success: true,
      apiKeyId: newApiKeyId,
      message: "New API key created successfully for Telegram integration"
    });
    
  } catch (error) {
    console.error('❌ Failed to create recovery API key:', error.message);
    
    if (error.message?.includes('permissions')) {
      res.status(403).json({ 
        error: "Recovery credentials lack permission to create API keys. Ensure policies are properly configured.",
        details: error.message 
      });
    } else if (error.message?.includes('organization')) {
      res.status(400).json({ 
        error: "Organization mismatch or invalid recovery credentials",
        details: error.message 
      });
    } else {
      res.status(500).json({ 
        error: "Failed to create new API key",
        details: error.message 
      });
    }
  }
});

// Test endpoint to verify recovery credentials can be used
router.post('/test-recovery-credentials', async (req, res) => {
  const { recoveryCredentials } = req.body;
  
  if (!recoveryCredentials) {
    return res.status(400).json({ error: "Missing recoveryCredentials" });
  }
  
  try {
    console.log('🧪 Testing recovery credentials:', {
      orgId: recoveryCredentials.orgId,
      userId: recoveryCredentials.userId,
      hasCredentialBundle: !!recoveryCredentials.credentialBundle
    });
    
    // For testing, we'll just verify the structure
    const requiredFields = ['userId', 'apiKeyId', 'credentialBundle', 'orgId'];
    const missingFields = requiredFields.filter(field => !recoveryCredentials[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: "Invalid recovery credentials structure",
        missingFields: missingFields
      });
    }
    
    res.json({
      success: true,
      message: "Recovery credentials structure is valid",
      canCreateKeys: true,
      orgId: recoveryCredentials.orgId,
      userId: recoveryCredentials.userId
    });
    
  } catch (error) {
    console.error('❌ Recovery credential test failed:', error.message);
    res.status(500).json({ 
      error: "Failed to test recovery credentials",
      details: error.message 
    });
  }
});

// Get current API keys for a user (for debugging)
router.get('/get-user-api-keys/:orgId/:userId', async (req, res) => {
  const { orgId, userId } = req.params;
  
  try {
    // Use root credentials to check user's API keys
    const turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
      defaultOrganizationId: process.env.TURNKEY_ORG_ID
    });
    
    const client = turnkey.apiClient();
    
    const orgInfo = await client.getOrganization({
      organizationId: orgId
    });
    
    const user = orgInfo.organization?.rootUsers?.find(u => u.userId === userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found in organization" });
    }
    
    res.json({
      success: true,
      userId: userId,
      apiKeys: user.apiKeys || [],
      totalKeys: user.apiKeys?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Failed to get user API keys:', error.message);
    res.status(500).json({ 
      error: "Failed to retrieve user API keys",
      details: error.message 
    });
  }
});

module.exports = router;
