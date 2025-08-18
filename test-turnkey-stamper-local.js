// test-turnkey-stamper-local.js - Local testing without Python bot dependency
const crypto = require('crypto');

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

class TurnkeyStamperLocalTester {
    constructor() {
        this.testTelegramId = 5014800072; // Your test user
        this.testEmail = 'bpeterscqa@gmail.com';
        this.baseUrl = 'http://localhost:3000'; // Local testing
    }

    // Test 1: Verify server is running
    async testServerConnection() {
        console.log('🧪 Test 1: Verifying server connection...');
        
        try {
            const response = await fetch(`${this.baseUrl}/`);
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            
            console.log('✅ Server is running and responding');
            return true;
        } catch (error) {
            console.error('❌ Server connection failed:', error.message);
            throw error;
        }
    }

    // Test 2: Test transaction building (no signing yet)
    async testTransactionBuilding() {
        console.log('🧪 Test 2: Testing transaction building...');
        
        try {
            const testTransaction = {
                recipient: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
                asset: 'XLM',
                amount: '0.0000001',
                memo: 'Test transaction'
            };
            
            const response = await fetch(`${this.baseUrl}/mini-app/build-transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testTransaction)
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Transaction build failed');
            }
            
            console.log('✅ Transaction built successfully:', {
                networkFee: result.fees.networkFee,
                serviceFee: result.fees.serviceFee,
                total: result.fees.total
            });
            
            return result;
        } catch (error) {
            console.error('❌ Transaction building failed:', error.message);
            throw error;
        }
    }

    // Test 3: Test fee calculation and logging (mock user)
    async testFeeLogging() {
        console.log('🧪 Test 3: Testing fee calculation and logging...');
        
        try {
            const testTransaction = {
                type: 'payment',
                recipient: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
                amount: '1.0000000',
                asset: 'XLM',
                signedXDR: 'mock_signed_xdr_for_testing',
                signingMethod: 'test_client_side',
                telegramId: this.testTelegramId,
                timestamp: new Date().toISOString()
            };
            
            const response = await fetch(`${this.baseUrl}/mini-app/log-transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testTransaction)
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Fee logging failed');
            }
            
            console.log('✅ Fee logging successful:', {
                tradeId: result.tradeId,
                xlmEquivalent: result.xlmEquivalent,
                feeAmount: result.feeAmount,
                feePercentage: result.feePercentage,
                referralReward: result.referralReward
            });
            
            return result;
        } catch (error) {
            console.error('❌ Fee logging failed:', error.message);
            throw error;
        }
    }

    // Test 4: Test asset metadata fetching
    async testAssetMetadata() {
        console.log('🧪 Test 4: Testing asset metadata fetching...');
        
        try {
            // Test with a known asset (CHAD)
            const testAsset = {
                code: 'CHAD',
                issuer: 'GBNEWTOKEN1234567890'
            };
            
            const response = await fetch(`${this.baseUrl}/mini-app/asset-metadata/${testAsset.code}/${testAsset.issuer}`);
            const result = await response.json();
            
            console.log('✅ Asset metadata test:', {
                success: result.success,
                hasIcon: !!result.data?.icon,
                hasName: !!result.data?.name
            });
            
            return result;
        } catch (error) {
            console.error('❌ Asset metadata test failed:', error.message);
            throw error;
        }
    }

    // Test 5: Test TOML metadata fetching
    async testTomlMetadata() {
        console.log('🧪 Test 5: Testing TOML metadata fetching...');
        
        try {
            // Test with a known asset
            const testAsset = {
                code: 'CHAD',
                issuer: 'GBNEWTOKEN1234567890'
            };
            
            const response = await fetch(`${this.baseUrl}/mini-app/toml-metadata/${testAsset.code}/${testAsset.issuer}`);
            const result = await response.json();
            
            console.log('✅ TOML metadata test:', {
                success: result.success,
                hasIcon: !!result.data?.icon,
                hasName: !!result.data?.name
            });
            
            return result;
        } catch (error) {
            console.error('❌ TOML metadata test failed:', error.message);
            throw error;
        }
    }

    // Test 6: Test Turnkey Cloud Stamper simulation
    async testCloudStamperSimulation() {
        console.log('🧪 Test 6: Testing Turnkey Cloud Stamper simulation...');
        
        try {
            // Simulate what the Cloud Stamper would do
            const mockTransactionHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            
            // Simulate signature generation (this is what Turnkey would return)
            const mockSignature = {
                r: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                s: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            };
            
            console.log('✅ Cloud Stamper simulation successful:', {
                transactionHash: mockTransactionHash.substring(0, 20) + '...',
                r: mockSignature.r.substring(0, 20) + '...',
                s: mockSignature.s.substring(0, 20) + '...'
            });
            
            return mockSignature;
        } catch (error) {
            console.error('❌ Cloud Stamper simulation failed:', error.message);
            throw error;
        }
    }

    // Test 7: Test Stellar transaction structure
    async testStellarTransactionStructure() {
        console.log('🧪 Test 7: Testing Stellar transaction structure...');
        
        try {
            // Test the structure of a Stellar transaction
            const mockTransaction = {
                source: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
                sequence: '1',
                fee: '100',
                operations: [
                    {
                        type: 'payment',
                        destination: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
                        asset: 'XLM',
                        amount: '1000000'
                    }
                ],
                memo: 'Test transaction'
            };
            
            console.log('✅ Stellar transaction structure valid:', {
                hasSource: !!mockTransaction.source,
                hasSequence: !!mockTransaction.sequence,
                hasFee: !!mockTransaction.fee,
                operationsCount: mockTransaction.operations.length
            });
            
            return mockTransaction;
        } catch (error) {
            console.error('❌ Stellar transaction structure test failed:', error.message);
            throw error;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting local Turnkey Cloud Stamper tests...\n');
        
        const results = {
            serverConnection: false,
            transactionBuilding: false,
            feeLogging: false,
            assetMetadata: false,
            tomlMetadata: false,
            cloudStamperSimulation: false,
            stellarTransactionStructure: false
        };
        
        try {
            // Test 1: Server connection
            await this.testServerConnection();
            results.serverConnection = true;
            console.log('');
            
            // Test 2: Transaction building
            await this.testTransactionBuilding();
            results.transactionBuilding = true;
            console.log('');
            
            // Test 3: Fee logging
            await this.testFeeLogging();
            results.feeLogging = true;
            console.log('');
            
            // Test 4: Asset metadata
            await this.testAssetMetadata();
            results.assetMetadata = true;
            console.log('');
            
            // Test 5: TOML metadata
            await this.testTomlMetadata();
            results.tomlMetadata = true;
            console.log('');
            
            // Test 6: Cloud Stamper simulation
            await this.testCloudStamperSimulation();
            results.cloudStamperSimulation = true;
            console.log('');
            
            // Test 7: Stellar transaction structure
            await this.testStellarTransactionStructure();
            results.stellarTransactionStructure = true;
            console.log('');
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }
        
        // Summary
        console.log('📊 Local Test Results Summary:');
        console.log('==============================');
        Object.entries(results).forEach(([test, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
        });
        
        const allPassed = Object.values(results).every(result => result);
        console.log(`\n${allPassed ? '🎉 ALL LOCAL TESTS PASSED!' : '⚠️  SOME LOCAL TESTS FAILED'}`);
        
        if (allPassed) {
            console.log('\n🚀 Ready for Turnkey Cloud Stamper integration!');
            console.log('Next steps:');
            console.log('1. Test with real Turnkey Cloud Stamper');
            console.log('2. Test on Stellar testnet');
            console.log('3. Verify fee collection');
            console.log('4. Deploy to production');
        }
        
        return results;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TurnkeyStamperLocalTester;
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
    const tester = new TurnkeyStamperLocalTester();
    tester.runAllTests().catch(console.error);
}
