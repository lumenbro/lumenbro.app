const { TransactionBuilder, Networks, Asset, Keypair, TransactionEnvelope, Operation } = require('@stellar/stellar-sdk');
const crypto = require('crypto');

class StellarTurnkeySigner {
  constructor() {
    this.networkPassphrase = Networks.PUBLIC;
  }

  // Build a test transaction
  async buildTestTransaction(sourcePublicKey, recipient, amount) {
    // For testing, we'll create a simple payment transaction
    // Use a proper Account object
    const account = {
      accountId: sourcePublicKey,
      sequenceNumber: () => '1'  // Make it a function
    };
    
    const transaction = new TransactionBuilder(
      account,
      {
        fee: '100',
        networkPassphrase: this.networkPassphrase
      }
    )
    .addOperation(Operation.payment({
      destination: recipient,
      asset: Asset.native(),
      amount: amount
    }))
    .setTimeout(30)
    .build();

    return transaction;
  }

  // Extract transaction hash (equivalent to Python's tx_envelope.hash())
  getTransactionHash(transaction) {
    const txEnvelope = TransactionEnvelope.fromXDR(transaction.toXDR(), this.networkPassphrase);
    const hash = txEnvelope.hash();
    return hash.toString('hex');
  }

  // Mock Turnkey signing (we'll replace this with real Turnkey API call)
  async mockTurnkeySign(payload, signWith) {
    console.log('Mock Turnkey signing:');
    console.log('  Payload (hex):', payload);
    console.log('  Sign with:', signWith);
    
    // Mock response format
    return {
      r: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      s: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'
    };
  }

  // Process Turnkey signature response
  processTurnkeySignature(r, s) {
    const hexSignature = r + s;
    console.log('Combined signature (hex):', hexSignature);
    
    if (hexSignature.length !== 128) {
      throw new Error(`Invalid signature length: ${hexSignature.length} (expected 128)`);
    }
    
    if (!/^[0-9a-fA-F]{128}$/.test(hexSignature)) {
      throw new Error('Invalid signature format (not hex)');
    }
    
    const signatureBytes = Buffer.from(hexSignature, 'hex');
    return signatureBytes;
  }

  // Create decorated signature (equivalent to Python's DecoratedSignature)
  createDecoratedSignature(publicKey, signatureBytes) {
    const keypair = Keypair.fromPublicKey(publicKey);
    const hint = keypair.signatureHint();
    
    console.log('Signature hint:', hint.toString('hex'));
    console.log('Signature bytes:', signatureBytes.toString('hex'));
    
    return {
      hint: hint,
      signature: signatureBytes
    };
  }

  // Add signature to transaction
  addSignatureToTransaction(transaction, decoratedSignature) {
    const txEnvelope = TransactionEnvelope.fromXDR(transaction.toXDR(), this.networkPassphrase);
    
    // Add the decorated signature
    txEnvelope.signatures.push({
      hint: decoratedSignature.hint,
      signature: decoratedSignature.signature
    });
    
    return txEnvelope.toXDR();
  }

  // Main signing function
  async signTransaction(sourcePublicKey, recipient, amount) {
    try {
      console.log('=== Stellar Turnkey Signing Test ===\n');
      
      // 1. Build transaction
      console.log('1. Building transaction...');
      const transaction = await this.buildTestTransaction(sourcePublicKey, recipient, amount);
      console.log('   Transaction XDR:', transaction.toXDR());
      
      // 2. Get transaction hash
      console.log('\n2. Extracting transaction hash...');
      const txHash = this.getTransactionHash(transaction);
      console.log('   Transaction hash (hex):', txHash);
      
      // 3. Sign with Turnkey (mock)
      console.log('\n3. Signing with Turnkey...');
      const signature = await this.mockTurnkeySign(txHash, sourcePublicKey);
      console.log('   Turnkey response:', signature);
      
      // 4. Process signature
      console.log('\n4. Processing signature...');
      const signatureBytes = this.processTurnkeySignature(signature.r, signature.s);
      
      // 5. Create decorated signature
      console.log('\n5. Creating decorated signature...');
      const decoratedSignature = this.createDecoratedSignature(sourcePublicKey, signatureBytes);
      
      // 6. Add signature to transaction
      console.log('\n6. Adding signature to transaction...');
      const signedXDR = this.addSignatureToTransaction(transaction, decoratedSignature);
      console.log('   Signed XDR:', signedXDR);
      
      console.log('\n=== Signing Complete ===');
      return signedXDR;
      
    } catch (error) {
      console.error('Signing failed:', error);
      throw error;
    }
  }
}

// Test the signer
async function testSigner() {
  const signer = new StellarTurnkeySigner();
  
  const sourcePublicKey = 'GBBR73HIBBG6RYEMYE2X6WYO4UATPXVDGJJZP4A3PPISZPXMPDQS65FY';
  const recipient = 'GCP62C7BD5XA343S4UNZIDHTFZW5VP75XONZL3UKWC36QTTPXUPNUUCE';
  const amount = '1.0000000';
  
  try {
    const signedXDR = await signer.signTransaction(sourcePublicKey, recipient, amount);
    console.log('\n✅ Test completed successfully!');
    console.log('Signed XDR length:', signedXDR.length);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSigner();
}

module.exports = StellarTurnkeySigner;
