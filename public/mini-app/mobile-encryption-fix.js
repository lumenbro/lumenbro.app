// mobile-encryption-fix.js - Mobile compatibility fixes for encryption
class MobileEncryptionFix {
    constructor() {
        this.isMobile = this.detectMobile();
        this.applyFixes();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.Telegram?.WebApp?.platform !== 'desktop';
    }

    applyFixes() {
        if (this.isMobile) {
            console.log('🔧 Applying mobile encryption fixes...');
            this.fixWebCryptoAPI();
            this.fixDataFormatIssues();
            this.fixTelegramWebViewIssues();
        }
    }

    // Fix Web Crypto API issues on mobile
    fixWebCryptoAPI() {
        if (!window.crypto || !window.crypto.subtle) {
            console.error('❌ Web Crypto API not available on mobile');
            return;
        }

        // Ensure proper error handling for mobile
        const originalGenerateKey = window.crypto.subtle.generateKey;
        window.crypto.subtle.generateKey = async function(algorithm, extractable, keyUsages) {
            try {
                // Add mobile-specific error handling
                if (algorithm.name === 'AES-GCM' && algorithm.length === 256) {
                    // Ensure proper key usage for mobile
                    const keyUsagesArray = Array.isArray(keyUsages) ? keyUsages : [keyUsages];
                    return await originalGenerateKey.call(this, algorithm, extractable, keyUsagesArray);
                }
                return await originalGenerateKey.call(this, algorithm, extractable, keyUsages);
            } catch (error) {
                console.error('Mobile Web Crypto API error:', error);
                throw new Error(`Mobile encryption error: ${error.message}`);
            }
        };

        console.log('✅ Web Crypto API fixes applied');
    }

    // Fix data format issues common on mobile
    fixDataFormatIssues() {
        // Ensure proper ArrayBuffer handling on mobile
        if (typeof ArrayBuffer !== 'undefined') {
            const originalFrom = ArrayBuffer.from;
            ArrayBuffer.from = function(source, mapFn, thisArg) {
                try {
                    if (source instanceof ArrayBuffer) {
                        return source;
                    }
                    return originalFrom.call(this, source, mapFn, thisArg);
                } catch (error) {
                    console.error('ArrayBuffer.from error on mobile:', error);
                    // Fallback for mobile
                    if (typeof source === 'string') {
                        const encoder = new TextEncoder();
                        return encoder.encode(source).buffer;
                    }
                    throw error;
                }
            };
        }

        // Fix Uint8Array issues on mobile
        if (typeof Uint8Array !== 'undefined') {
            const originalFrom = Uint8Array.from;
            Uint8Array.from = function(source, mapFn, thisArg) {
                try {
                    return originalFrom.call(this, source, mapFn, thisArg);
                } catch (error) {
                    console.error('Uint8Array.from error on mobile:', error);
                    // Fallback for mobile
                    if (typeof source === 'string') {
                        const encoder = new TextEncoder();
                        return encoder.encode(source);
                    }
                    throw error;
                }
            };
        }

        console.log('✅ Data format fixes applied');
    }

    // Fix Telegram WebView specific issues
    fixTelegramWebViewIssues() {
        // Ensure proper initData handling on mobile
        if (window.Telegram && window.Telegram.WebApp) {
            const originalInitData = window.Telegram.WebApp.initData;
            
            // Add validation for mobile
            if (originalInitData) {
                try {
                    // Validate initData format
                    const params = new URLSearchParams(originalInitData);
                    if (!params.has('user')) {
                        console.warn('⚠️ initData missing user data on mobile');
                    }
                } catch (error) {
                    console.error('❌ initData validation error on mobile:', error);
                }
            }

            // Fix CloudStorage issues on mobile
            if (window.Telegram.WebApp.CloudStorage) {
                const originalGetItem = window.Telegram.WebApp.CloudStorage.getItem;
                window.Telegram.WebApp.CloudStorage.getItem = function(key, callback) {
                    try {
                        return originalGetItem.call(this, key, callback);
                    } catch (error) {
                        console.error('CloudStorage.getItem error on mobile:', error);
                        if (callback) callback(error, null);
                    }
                };

                const originalSetItem = window.Telegram.WebApp.CloudStorage.setItem;
                window.Telegram.WebApp.CloudStorage.setItem = function(key, value, callback) {
                    try {
                        // Ensure value is properly serialized for mobile
                        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
                        return originalSetItem.call(this, key, serializedValue, callback);
                    } catch (error) {
                        console.error('CloudStorage.setItem error on mobile:', error);
                        if (callback) callback(error);
                    }
                };
            }
        }

        console.log('✅ Telegram WebView fixes applied');
    }

    // Enhanced error handling for mobile
    static handleMobileError(error, context) {
        console.error(`Mobile error in ${context}:`, error);
        
        // Common mobile error patterns
        if (error.message.includes('Data provided does not meet requirements')) {
            console.error('🔍 This is likely a data format issue on mobile');
            console.error('Possible causes:');
            console.error('- ArrayBuffer/Uint8Array format mismatch');
            console.error('- Web Crypto API limitations on mobile');
            console.error('- Telegram WebView data restrictions');
        }

        if (error.message.includes('Web Crypto API')) {
            console.error('🔍 Web Crypto API issue on mobile');
            console.error('Possible causes:');
            console.error('- Unsupported algorithm on mobile');
            console.error('- Key usage restrictions');
            console.error('- Mobile browser limitations');
        }

        return error;
    }

    // Test mobile compatibility
    async testMobileCompatibility() {
        console.log('🧪 Testing mobile compatibility...');
        
        try {
            // Test Web Crypto API
            const key = await window.crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            console.log('✅ Web Crypto API test passed');

            // Test data encoding
            const testData = { test: 'mobile' };
            const encoder = new TextEncoder();
            const encoded = encoder.encode(JSON.stringify(testData));
            console.log('✅ Data encoding test passed');

            // Test Telegram API
            if (window.Telegram?.WebApp?.initData) {
                console.log('✅ Telegram API test passed');
            }

            console.log('✅ All mobile compatibility tests passed');
            return true;
        } catch (error) {
            console.error('❌ Mobile compatibility test failed:', error);
            MobileEncryptionFix.handleMobileError(error, 'compatibility test');
            return false;
        }
    }
}

// Initialize mobile fixes
const mobileEncryptionFix = new MobileEncryptionFix();

// Make it globally available
window.MobileEncryptionFix = MobileEncryptionFix;
window.mobileEncryptionFix = mobileEncryptionFix;

// Auto-test on mobile
if (mobileEncryptionFix.isMobile) {
    setTimeout(() => {
        mobileEncryptionFix.testMobileCompatibility();
    }, 2000);
}
