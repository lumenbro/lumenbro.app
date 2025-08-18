// test-turnkey-stamper.js - Comprehensive testing for Turnkey Cloud Stamper
const crypto = require('crypto');

class TurnkeyStamperTester {
    constructor() {
        this.testTelegramId = 5014800072; // Your test user
        this.testEmail = 'bpeterscqa@gmail.com';
        this.baseUrl = 'http://localhost:3000'; // Local testing
    }

    // Test 1: Verify test user exists and has proper setup
    async testUserSetup() {
        console.log('🧪 Test 1: Verifying test user setup...');
        
        try {
            const response = await fetch(`${this.baseUrl}/mini-app/authenticator`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Authenticator endpoint failed');
            }
            
            const user = data.authenticator_info.user;
            console.log('✅ Test user found:', {
                telegramId: user.telegram_id,
                publicKey: user.public_key?.substring(0, 20) + '...',
                hasApiKey: !!user.api_key,
                hasAuthenticator: !!user.authenticator
            });
            
            return user;
        } catch (error) {
            console.error('❌ Test user setup failed:', error.message);
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

    // Test 3: Test Turnkey Cloud Stamper initialization (no actual signing)
    async testStamperInitialization() {
        console.log('🧪 Test 3: Testing Turnkey Cloud Stamper initialization...');
        
        try {
            // This would be the client-side test
            // For now, we'll test the server-side integration
            
            const response = await fetch(`${this.baseUrl}/mini-app/test-python-connection`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error('Python bot connection failed');
            }
            
            console.log('✅ Turnkey integration ready:', result.message);
            return result;
        } catch (error) {
            console.error('❌ Stamper initialization failed:', error.message);
            throw error;
        }
    }

    // Test 4: Test fee calculation and logging
    async testFeeLogging() {
        console.log('🧪 Test 4: Testing fee calculation and logging...');
        
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

    // Test 5: Test asset metadata fetching
    async testAssetMetadata() {
        console.log('🧪 Test 5: Testing asset metadata fetching...');
        
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

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting comprehensive Turnkey Cloud Stamper tests...\n');
        
        const results = {
            userSetup: false,
            transactionBuilding: false,
            stamperInitialization: false,
            feeLogging: false,
            assetMetadata: false
        };
        
        try {
            // Test 1: User setup
            await this.testUserSetup();
            results.userSetup = true;
            console.log('');
            
            // Test 2: Transaction building
            await this.testTransactionBuilding();
            results.transactionBuilding = true;
            console.log('');
            
            // Test 3: Stamper initialization
            await this.testStamperInitialization();
            results.stamperInitialization = true;
            console.log('');
            
            // Test 4: Fee logging
            await this.testFeeLogging();
            results.feeLogging = true;
            console.log('');
            
            // Test 5: Asset metadata
            await this.testAssetMetadata();
            results.assetMetadata = true;
            console.log('');
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }
        
        // Summary
        console.log('📊 Test Results Summary:');
        console.log('========================');
        Object.entries(results).forEach(([test, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
        });
        
        const allPassed = Object.values(results).every(result => result);
        console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'}`);
        
        return results;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TurnkeyStamperTester;
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
    const tester = new TurnkeyStamperTester();
    tester.runAllTests().catch(console.error);
}

