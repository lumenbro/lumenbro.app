(function() {
  function showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + (type || '');
    el.style.display = 'block';
    if (type !== 'loading') {
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }

  function toUint8(arr) {
    return new Uint8Array(arr);
  }

  async function deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function decryptBackup(file, password) {
    const text = await file.text();
    let bk;
    try {
      bk = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid .lbk file: not JSON');
    }
    if (!bk || !bk.kdf || !bk.cipher || !bk.payload) {
      throw new Error('Invalid .lbk structure');
    }

    const salt = toUint8(bk.kdf.salt || []);
    const iv = toUint8(bk.cipher.iv || []);
    const payload = toUint8(bk.payload || []);

    // In WebCrypto AES-GCM, tag is appended to ciphertext (supported directly)
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, payload);
    const json = new TextDecoder().decode(plaintext);
    let data;
    try { data = JSON.parse(json); } catch { throw new Error('Decrypted content is not JSON'); }
    if (!data || !data.data) throw new Error('Missing data field');
    return data.data; // { stellarPrivateKey, stellarSAddress, stellarAddress }
  }

  async function onDecrypt() {
    const file = document.getElementById('fileInput').files[0];
    const password = document.getElementById('passwordInput').value;
    if (!file) return showStatus('Select a .lbk file', 'error');
    if (!password) return showStatus('Enter password', 'error');
    try {
      showStatus('Decrypting...', 'loading');
      const data = await decryptBackup(file, password);
      document.getElementById('privHex').textContent = data.stellarPrivateKey || '';
      document.getElementById('saddr').textContent = data.stellarSAddress || '';
      document.getElementById('pubaddr').textContent = data.stellarAddress || '';
      document.getElementById('results').style.display = 'block';
      showStatus('Decryption successful', 'success');
    } catch (e) {
      console.error(e);
      showStatus('Decryption failed: ' + e.message, 'error');
    }
  }

  function onClear() {
    document.getElementById('fileInput').value = '';
    document.getElementById('passwordInput').value = '';
    document.getElementById('results').style.display = 'none';
  }

  function copyText(id) {
    const text = document.getElementById(id).textContent || '';
    navigator.clipboard.writeText(text).then(() => showStatus('Copied', 'success')).catch(() => showStatus('Copy failed', 'error'));
  }

  function onDownloadTxt() {
    const priv = document.getElementById('privHex').textContent || '';
    const saddr = document.getElementById('saddr').textContent || '';
    const pub = document.getElementById('pubaddr').textContent || '';
    const content = window.ExportUtils.createBackupFileContent(priv, saddr, pub);
    window.ExportUtils.downloadAsFile(content, `lumenbro-wallet-plaintext-${Date.now()}.txt`);
    showStatus('Plaintext downloaded', 'success');
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('decryptBtn').addEventListener('click', onDecrypt);
    document.getElementById('clearBtn').addEventListener('click', onClear);
    document.getElementById('copyPriv').addEventListener('click', () => copyText('privHex'));
    document.getElementById('copySaddr').addEventListener('click', () => copyText('saddr'));
    document.getElementById('copyPub').addEventListener('click', () => copyText('pubaddr'));
    document.getElementById('downloadTxt').addEventListener('click', onDownloadTxt);
  });
})();


