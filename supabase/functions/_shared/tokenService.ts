const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface TokenBundle {
  pageAccessToken: string;
  userAccessToken: string;
}

const base64ToBytes = (base64: string): Uint8Array => {
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const loadKeys = async (): Promise<CryptoKey[]> => {
  const keys: CryptoKey[] = [];
  const envKeys = [
    Deno.env.get('TOKEN_ENCRYPTION_KEY_BASE64'),
    Deno.env.get('INSTAPILOT_TOKEN_ENCRYPTION_KEY_BASE64'),
    Deno.env.get('AUTODM_TOKEN_ENCRYPTION_KEY_BASE64')
  ];

  for (const keyBase64 of envKeys) {
    if (!keyBase64 || keyBase64.trim() === '') continue;
    
    let keyBytes: Uint8Array;
    try {
      keyBytes = base64ToBytes(keyBase64.trim());
    } catch (e) {
      console.warn('Skipping invalid base64 encryption key in environment');
      continue;
    }
    
    if (keyBytes.length !== 32) continue;
    
    const keyBuffer = toArrayBuffer(keyBytes);

    const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
    keys.push(key);
  }

  if (keys.length === 0) {
    throw new Error('No valid 32-byte encryption keys found in environment');
  }

  return keys;
};

export const encryptTokenBundle = async (bundle: TokenBundle): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keys = await loadKeys();
  const key = keys[0]; // Encrypt with the primary key
  const plaintext = encoder.encode(JSON.stringify(bundle));

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return `enc:v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
};

export const decryptTokenBundle = async (ciphertext: string): Promise<TokenBundle> => {
  const [prefix, version, ivBase64, payloadBase64] = ciphertext.split(':');

  if (prefix !== 'enc' || version !== 'v1' || !ivBase64 || !payloadBase64) {
    throw new Error('Invalid encrypted token format');
  }

  const keys = await loadKeys();
  const iv = base64ToBytes(ivBase64);
  const ivBuffer = toArrayBuffer(iv);
  const encryptedBytes = base64ToBytes(payloadBase64);
  const encryptedBuffer = toArrayBuffer(encryptedBytes);

  let decrypted: ArrayBuffer | null = null;
  let lastError: Error | null = null;

  for (const key of keys) {
    try {
      decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        key,
        encryptedBuffer
      );
      break;
    } catch (e) {
      lastError = e as Error;
    }
  }

  if (!decrypted) {
    throw new Error(`Decryption failed: ${lastError?.message}`);
  }

  const parsed = JSON.parse(decoder.decode(new Uint8Array(decrypted))) as Partial<TokenBundle>;

  if (!parsed.pageAccessToken) {
    throw new Error('Token bundle missing pageAccessToken');
  }

  return {
    pageAccessToken: parsed.pageAccessToken,
    userAccessToken: parsed.userAccessToken || '',
  };
};
