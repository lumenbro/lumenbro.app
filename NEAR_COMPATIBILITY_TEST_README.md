# NEAR Protocol Compatibility Test

This test page demonstrates Turnkey's compatibility with NEAR Protocol by creating NEAR accounts and testing transaction signing.

## Overview

The test page (`/test-near-compatibility`) provides a step-by-step interface to:

1. **Setup Authentication**: Retrieve Turnkey API keys from Telegram Cloud Storage
2. **Create NEAR Account**: Generate a new NEAR account under an existing HD wallet
3. **Test Signing**: Sign a mock NEAR transaction and verify the signature
4. **Submit to Testnet**: Submit the signed transaction to NEAR testnet

## Prerequisites

### Environment Variables

Set these environment variables for the test:

```bash
# Test configuration
TEST_SUB_ORG_ID=your-test-sub-org-id
TEST_HD_WALLET_ID=existing-hd-wallet-id

# Existing Turnkey configuration
TURNKEY_API_PUBLIC_KEY=your-api-public-key
TURNKEY_API_PRIVATE_KEY=your-api-private-key
TURNKEY_ORG_ID=your-org-id
```

### Telegram Mini App Setup

1. Ensure you have registered with the LumenBro mini app
2. Your Turnkey API keys should be stored in Telegram Cloud Storage
3. You should have an existing HD wallet with at least one Stellar account

## How to Use

### 1. Access the Test Page

Navigate to: `https://your-domain.com/test-near-compatibility`

### 2. Step 1: Setup Authentication

- Enter your password (used to decrypt API keys from Telegram Cloud Storage)
- Click "Setup Authentication"
- The page will retrieve and decrypt your Turnkey API keys

### 3. Step 2: Create NEAR Account

- The page will auto-fill your test sub-org ID and HD wallet ID (if configured)
- Click "Create NEAR Account"
- This will call Turnkey's `createWalletAccounts` API with:
  - **Curve**: `CURVE_ED25519`
  - **Path Format**: `PATH_FORMAT_BIP32`
  - **Path**: `m/44'/397'/0'` (NEAR BIP44 path)
  - **Address Format**: `ADDRESS_FORMAT_COMPRESSED`

### 4. Step 3: Test NEAR Signing

- Click "Test NEAR Signing"
- This creates a mock NEAR transaction and signs it using Turnkey
- The signature is verified using near-api-js
- Click "Submit to NEAR Testnet" to submit the transaction

## Technical Details

### NEAR Account Creation

The test uses Turnkey's `createWalletAccounts` API with these parameters:

```javascript
{
  type: "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS",
  organizationId: subOrgId,
  parameters: {
    walletId: hdWalletId,
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: "m/44'/397'/0'",
    addressFormat: "ADDRESS_FORMAT_COMPRESSED"
  }
}
```

### NEAR Transaction Signing

The test creates a mock function call transaction to `v1.signer.testnet.near`:

```javascript
const transaction = nearApi.transactions.createTransaction(
  nearAccountAddress,
  nearApi.utils.PublicKey.fromString(nearPublicKey),
  'v1.signer.testnet.near',
  nearApi.transactions.functionCall('sign', args, gas, deposit),
  blockHash,
  nonce
);
```

### Signature Verification

The signed transaction is verified using near-api-js:

```javascript
const isValid = nearApi.utils.KeyPair.fromPublicKey(publicKeyObj).verify(
  serializedTx,
  Buffer.from(signature, 'hex')
);
```

## API Endpoints

### Backend Support

The test page uses these backend endpoints:

- `GET /api/near-test/config` - Get test configuration
- `GET /api/near-test/wallet-accounts/:subOrgId` - Get existing wallet accounts
- `POST /api/near-test/log-result` - Log test results

### Turnkey API Calls

- `createWalletAccounts` - Create NEAR account
- `signRawPayload` - Sign NEAR transaction

## NEAR Protocol Integration

### NEAR Implicit Accounts

NEAR implicit accounts are derived from Ed25519 public keys:
- Public key: `ed25519:...`
- NEAR address: `hex-pubkey.near`

### BIP44 Path

NEAR uses BIP44 path `m/44'/397'/0'`:
- `44'` - BIP44 standard
- `397'` - NEAR coin type
- `0'` - Account index

### Transaction Format

NEAR transactions are serialized using Borsh and include:
- Signer ID
- Receiver ID
- Actions (function calls, transfers, etc.)
- Block hash
- Nonce

## Error Handling

The test includes comprehensive error handling:

- **Authentication errors**: Invalid password or missing API keys
- **API errors**: Turnkey API failures
- **Signing errors**: Invalid transaction format or signing failures
- **Network errors**: NEAR testnet submission failures

All errors are logged to the backend for monitoring.

## Security Considerations

- API keys are encrypted in Telegram Cloud Storage
- No private keys are exposed in the browser
- All signing happens server-side via Turnkey
- Test transactions use minimal gas and no deposits

## Monitoring

Test results are logged to the backend console and include:
- Test type and success status
- Account IDs and public keys (truncated)
- Transaction hashes
- Error messages

## Troubleshooting

### Common Issues

1. **"Test sub-organization ID not configured"**
   - Set `TEST_SUB_ORG_ID` environment variable

2. **"Test HD wallet ID not configured"**
   - Set `TEST_HD_WALLET_ID` environment variable

3. **"Authentication failed"**
   - Check your password
   - Ensure API keys are stored in Telegram Cloud Storage

4. **"No wallet accounts returned"**
   - Verify your sub-org ID and HD wallet ID
   - Check Turnkey API permissions

5. **"NEAR signing test failed"**
   - Verify NEAR account was created successfully
   - Check transaction format and parameters

### Debug Information

Enable browser developer tools to see:
- API request/response details
- Turnkey SDK logs
- NEAR API interactions
- Error stack traces

## Future Enhancements

Potential improvements:
- Support for mainnet testing
- Multiple NEAR account creation
- Complex transaction types (deployments, etc.)
- Performance benchmarking
- Integration with other NEAR tools
