const AWS = require('aws-sdk');
const crypto = require('crypto');

class KMSService {
  constructor() {
    // Configure AWS SDK
    this.kms = new AWS.KMS({
      region: process.env.AWS_REGION || 'us-west-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    
    this.kmsKeyId = process.env.KMS_KEY_ID || 'alias/lumenbro-session-key';
  }

  /**
   * Encrypt session keys with KMS
   * @param {string} publicKey - Session public key
   * @param {string} privateKey - Session private key
   * @returns {Promise<{encryptedData: string, keyId: string}>}
   */
  async encryptSessionKeys(publicKey, privateKey) {
    try {
      // Combine public and private keys into a single payload
      const sessionData = {
        publicKey,
        privateKey,
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      const plaintext = JSON.stringify(sessionData);
      
      const params = {
        KeyId: this.kmsKeyId,
        Plaintext: Buffer.from(plaintext, 'utf8'),
        EncryptionContext: {
          'Service': 'lumenbro-session-keys',
          'Environment': process.env.NODE_ENV || 'development'
        }
      };

      const result = await this.kms.encrypt(params).promise();
      
      return {
        encryptedData: result.CiphertextBlob.toString('base64'),
        keyId: result.KeyId
      };
    } catch (error) {
      console.error('KMS encryption failed:', error);
      throw new Error(`Failed to encrypt session keys: ${error.message}`);
    }
  }

  /**
   * Decrypt session keys with KMS
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} keyId - KMS key ID used for encryption
   * @returns {Promise<{publicKey: string, privateKey: string}>}
   */
  async decryptSessionKeys(encryptedData, keyId) {
    try {
      const params = {
        CiphertextBlob: Buffer.from(encryptedData, 'base64'),
        EncryptionContext: {
          'Service': 'lumenbro-session-keys',
          'Environment': process.env.NODE_ENV || 'development'
        }
      };

      const result = await this.kms.decrypt(params).promise();
      const decryptedText = result.Plaintext.toString('utf8');
      const sessionData = JSON.parse(decryptedText);
      
      return {
        publicKey: sessionData.publicKey,
        privateKey: sessionData.privateKey
      };
    } catch (error) {
      console.error('KMS decryption failed:', error);
      throw new Error(`Failed to decrypt session keys: ${error.message}`);
    }
  }

  /**
   * Create a new KMS key for session encryption
   * @returns {Promise<string>} Key ID
   */
  async createSessionKey() {
    try {
      const params = {
        Description: 'Session key encryption for Lumenbro',
        KeyUsage: 'ENCRYPT_DECRYPT',
        Origin: 'AWS_KMS',
        Tags: [
          {
            TagKey: 'Service',
            TagValue: 'lumenbro'
          },
          {
            TagKey: 'Purpose',
            TagValue: 'session-key-encryption'
          }
        ]
      };

      const result = await this.kms.createKey(params).promise();
      console.log('Created KMS key:', result.KeyMetadata.KeyId);
      return result.KeyMetadata.KeyId;
    } catch (error) {
      console.error('Failed to create KMS key:', error);
      throw new Error(`Failed to create KMS key: ${error.message}`);
    }
  }

  /**
   * Test KMS connectivity and permissions
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      // Try to list keys to test permissions
      const result = await this.kms.listKeys({ Limit: 1 }).promise();
      console.log('KMS connection successful');
      return true;
    } catch (error) {
      console.error('KMS connection failed:', error);
      return false;
    }
  }
}

module.exports = KMSService; 