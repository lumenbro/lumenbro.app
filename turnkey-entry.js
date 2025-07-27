import { TurnkeyBrowserClient } from '@turnkey/sdk-browser';
import { IframeStamper } from '@turnkey/iframe-stamper';
import { getWebAuthnAttestation } from '@turnkey/http';
import { TelegramCloudStorageStamper } from '@turnkey/telegram-cloud-storage-stamper';  // Named import for the class
import { p256 } from '@noble/curves/p256';  // Add this for P256 key gen

window.Turnkey = {
  TurnkeyBrowserClient,
  IframeStamper,
  getWebAuthnAttestation,
  TelegramCloudStorageStamper,  // Expose the class (use TelegramCloudStorageStamper.create() in client code)
  generateP256KeyPair: () => {  // New: Generate compressed P256 keypair in hex
    const priv = p256.utils.randomPrivateKey();
    const pub = p256.getPublicKey(priv);  // Compressed by default (33 bytes)
    return {
      publicKey: p256.utils.bytesToHex(pub),
      privateKey: p256.utils.bytesToHex(priv)
    };
  }
};
