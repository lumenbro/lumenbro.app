// mobile-debug.js - Mobile-compatible debugging for Telegram Mini App
class MobileDebug {
    constructor() {
        this.debugContainer = null;
        this.logs = [];
        this.isMobile = this.detectMobile();
        this.init();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.Telegram?.WebApp?.platform !== 'desktop';
    }

    init() {
        if (this.isMobile) {
            // Suppress on sensitive flows (e.g., login) to avoid UI interference
            const params = new URLSearchParams(window.location.search);
            this.suppressUI = params.get('action') === 'login';

            if (!this.suppressUI) {
                this.createDebugContainer();
            }

            this.overrideConsole();
            this.log('🔍 Mobile debug mode activated');
            this.log(`Platform: ${window.Telegram?.WebApp?.platform || 'unknown'}`);
            this.log(`User Agent: ${navigator.userAgent.substring(0, 50)}...`);
            if (this.suppressUI) {
                this.log('⚠️ Debug UI suppressed on login flow to prevent input blocking');
            }
        }
    }

    createDebugContainer() {
        // If UI is suppressed, do not render any overlay elements
        if (this.suppressUI) {
            return;
        }

        this.debugContainer = document.createElement('div');
        this.debugContainer.id = 'mobile-debug-container';
        this.debugContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            overflow-y: auto;
            z-index: 9999;
            display: none;
            pointer-events: none; /* never block input when hidden */
        `;
        
        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0;">🐛 Mobile Debug Console</h3>
                <button onclick="mobileDebug.toggle()" style="background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                    Toggle
                </button>
            </div>
        `;
        
        this.debugContainer.appendChild(header);
        document.body.appendChild(this.debugContainer);
        
        // Add toggle button to page
        const toggleBtn = document.createElement('button');
        toggleBtn.innerHTML = '🐛 Debug';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 100; /* keep below app modals */
            font-size: 12px;
            pointer-events: auto;
        `;
        toggleBtn.onclick = () => this.toggle();
        document.body.appendChild(toggleBtn);
    }

    overrideConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            originalLog.apply(console, args);
            this.log('LOG:', ...args);
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            this.log('ERROR:', ...args);
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.log('WARN:', ...args);
        };
    }

    log(...args) {
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        const logEntry = `[${timestamp}] ${message}`;
        this.logs.push(logEntry);

        if (this.debugContainer) {
            const logElement = document.createElement('div');
            logElement.style.cssText = `
                margin-bottom: 5px;
                word-break: break-all;
                white-space: pre-wrap;
            `;
            logElement.textContent = logEntry;
            this.debugContainer.appendChild(logElement);
            this.debugContainer.scrollTop = this.debugContainer.scrollHeight;
        }
    }

    toggle() {
        if (this.debugContainer) {
            const showing = this.debugContainer.style.display === 'none';
            this.debugContainer.style.display = showing ? 'block' : 'none';
            this.debugContainer.style.pointerEvents = showing ? 'auto' : 'none';
        }
    }

    // Test Web Crypto API compatibility
    testWebCrypto() {
        this.log('🔍 Testing Web Crypto API...');
        
        if (!window.crypto || !window.crypto.subtle) {
            this.log('❌ Web Crypto API not available');
            return false;
        }

        this.log('✅ Web Crypto API available');
        
        // Test basic operations
        try {
            // Test key generation
            const testKey = window.crypto.subtle.generateKey(
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
            this.log('✅ Key generation test passed');
        } catch (error) {
            this.log('❌ Key generation test failed:', error.message);
        }

        return true;
    }

    // Test Telegram WebApp API
    testTelegramAPI() {
        this.log('🔍 Testing Telegram WebApp API...');
        
        if (!window.Telegram || !window.Telegram.WebApp) {
            this.log('❌ Telegram WebApp API not available');
            return false;
        }

        this.log('✅ Telegram WebApp API available');
        this.log('Platform:', window.Telegram.WebApp.platform);
        this.log('Version:', window.Telegram.WebApp.version);
        this.log('Init Data:', window.Telegram.WebApp.initData ? 'Available' : 'Not available');
        
        return true;
    }

    // Test encryption utilities
    async testEncryption() {
        this.log('🔍 Testing encryption utilities...');
        
        if (!window.EncryptionUtils) {
            this.log('❌ EncryptionUtils not available');
            return false;
        }

        try {
            // Test basic encryption using available functions
            const testPrivateKey = 'test1234567890abcdef';
            const password = 'test123';
            
            this.log('Testing encryption with test private key');
            const encrypted = await window.EncryptionUtils.encryptPrivateKey(testPrivateKey, password);
            this.log('✅ Encryption successful:', JSON.stringify(encrypted).substring(0, 50) + '...');
            
            const decrypted = await window.EncryptionUtils.decryptPrivateKey(encrypted, password);
            this.log('✅ Decryption successful:', decrypted);
            
            return true;
        } catch (error) {
            this.log('❌ Encryption test failed:', error.message);
            return false;
        }
    }

    // Run all tests
    async runTests() {
        this.log('🧪 Running mobile compatibility tests...');
        
        this.testWebCrypto();
        this.testTelegramAPI();
        await this.testEncryption();
        
        this.log('✅ All tests completed');
    }
}

// Initialize mobile debug
const mobileDebug = new MobileDebug();

// Make it globally available
window.mobileDebug = mobileDebug;

// Auto-run tests on mobile
if (mobileDebug.isMobile) {
    setTimeout(() => {
        mobileDebug.runTests();
    }, 1000);
}
