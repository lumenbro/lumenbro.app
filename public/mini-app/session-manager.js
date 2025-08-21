// session-manager.js - Safe session-based API key management
// Uses IndexedDB to store decrypted keys temporarily, avoiding Telegram Cloud Storage conflicts

class SessionManager {
    constructor() {
        this.dbName = 'LumenBroSessionDB';
        this.dbVersion = 1;
        this.storeName = 'apiKeys';
        this.sessionDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    }

    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('❌ IndexedDB initialization failed:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store for API keys
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'sessionId' });
                    store.createIndex('expiresAt', 'expiresAt', { unique: false });
                    console.log('✅ IndexedDB store created:', this.storeName);
                }
            };
        });
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Store API keys in session (safe, no overwriting)
    async storeSessionKeys(apiKeys, sessionId = null) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const sessionIdToUse = sessionId || this.generateSessionId();
            const expiresAt = Date.now() + this.sessionDuration;

            const sessionData = {
                sessionId: sessionIdToUse,
                apiPublicKey: apiKeys.apiPublicKey,
                apiPrivateKey: apiKeys.apiPrivateKey,
                expiresAt: expiresAt,
                createdAt: Date.now()
            };

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Use add() instead of put() to prevent overwriting
            const request = store.add(sessionData);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ Session keys stored safely in IndexedDB');
                    resolve(sessionIdToUse);
                };

                request.onerror = () => {
                    if (request.error.name === 'ConstraintError') {
                        // Session ID already exists, generate new one
                        console.log('⚠️ Session ID conflict, generating new one...');
                        this.storeSessionKeys(apiKeys).then(resolve).catch(reject);
                    } else {
                        console.error('❌ Failed to store session keys:', request.error);
                        reject(request.error);
                    }
                };
            });

        } catch (error) {
            console.error('❌ Session storage failed:', error);
            throw error;
        }
    }

    // Retrieve API keys from session
    async getSessionKeys(sessionId) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(sessionId);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const sessionData = request.result;
                    
                    if (!sessionData) {
                        reject(new Error('Session not found'));
                        return;
                    }

                    // Check if session has expired
                    if (Date.now() > sessionData.expiresAt) {
                        console.log('⚠️ Session expired, cleaning up...');
                        this.deleteSessionKeys(sessionId);
                        reject(new Error('Session expired'));
                        return;
                    }

                    console.log('✅ Session keys retrieved from IndexedDB');
                    resolve({
                        apiPublicKey: sessionData.apiPublicKey,
                        apiPrivateKey: sessionData.apiPrivateKey,
                        expiresAt: sessionData.expiresAt
                    });
                };

                request.onerror = () => {
                    console.error('❌ Failed to retrieve session keys:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error('❌ Session retrieval failed:', error);
            throw error;
        }
    }

    // Delete session keys
    async deleteSessionKeys(sessionId) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(sessionId);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ Session keys deleted from IndexedDB');
                    resolve();
                };

                request.onerror = () => {
                    console.error('❌ Failed to delete session keys:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error('❌ Session deletion failed:', error);
            throw error;
        }
    }

    // Clean up expired sessions
    async cleanupExpiredSessions() {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('expiresAt');
            const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));

            let deletedCount = 0;

            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        deletedCount++;
                        cursor.continue();
                    } else {
                        if (deletedCount > 0) {
                            console.log(`🧹 Cleaned up ${deletedCount} expired sessions`);
                        }
                        resolve(deletedCount);
                    }
                };

                request.onerror = () => {
                    console.error('❌ Failed to cleanup expired sessions:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error('❌ Session cleanup failed:', error);
            throw error;
        }
    }

    // List all active sessions (for debugging)
    async listActiveSessions() {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const sessions = request.result.filter(session => 
                        Date.now() <= session.expiresAt
                    );
                    console.log(`📊 Found ${sessions.length} active sessions`);
                    resolve(sessions);
                };

                request.onerror = () => {
                    console.error('❌ Failed to list sessions:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error('❌ Session listing failed:', error);
            throw error;
        }
    }

    // Check if IndexedDB is available
    static isAvailable() {
        return typeof indexedDB !== 'undefined';
    }
}

// Global session manager instance
window.SessionManager = new SessionManager();

// Auto-cleanup on page load
window.addEventListener('load', () => {
    if (SessionManager.isAvailable()) {
        SessionManager.cleanupExpiredSessions().catch(error => {
            console.warn('⚠️ Auto-cleanup failed:', error);
        });
    }
});

console.log('✅ SessionManager loaded - IndexedDB available:', SessionManager.isAvailable());
