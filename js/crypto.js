const VaultCrypto = (() => {
  const ALGORITHM = 'AES-GCM';
  const KEY_LENGTH = 256;
  const SALT_LENGTH = 32;
  const IV_LENGTH = 12;
  const PBKDF2_ITERATIONS = 600000;

  function bufToBase64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(data, password, existingSalt) {
    const salt = existingSalt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      typeof data === 'string' ? enc.encode(data) : data
    );
    const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return bufToBase64(combined.buffer);
  }

  async function decrypt(encrypted, password) {
    const combined = new Uint8Array(base64ToBuf(encrypted));
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  }

  async function encryptFile(file, password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const fileBuf = await file.arrayBuffer();
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      fileBuf
    );
    const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return bufToBase64(combined.buffer);
  }

  async function decryptFile(encrypted, password) {
    const combined = new Uint8Array(base64ToBuf(encrypted));
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );
    return new Uint8Array(plaintext);
  }

  function generateRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  return { encrypt, decrypt, encryptFile, decryptFile, generateRoomId };
})();
