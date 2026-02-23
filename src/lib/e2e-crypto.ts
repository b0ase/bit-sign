/**
 * End-to-End Encryption Library for Bit-Sign
 *
 * Uses Web Crypto API (SubtleCrypto) — no external dependencies.
 * Architecture: One encrypted document, multiple key wrappings per recipient.
 * The server never sees plaintext after encryption.
 *
 * Flow:
 *   1. Generate ECDH P-256 keypair (stored per user)
 *   2. encryptDocument() → random AES-256-GCM envelope key encrypts document
 *   3. wrapKeyForRecipient() → ECDH key agreement + HKDF → AES-KW wraps envelope key
 *   4. unwrapKey() → recipient reverses ECDH → recovers envelope key
 *   5. decryptDocument() → AES-256-GCM decrypts with recovered envelope key
 */

import { bufferToBase64, base64ToBuffer } from './attestation';

// Re-export helpers so consumers only need one import
export { bufferToBase64, base64ToBuffer };

// ─── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generate an ECDH P-256 keypair for E2E encryption.
 * Returns exportable JWK representations of both keys.
 */
export async function generateKeyPair(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}

// ─── Key Import / Export ─────────────────────────────────────────────────────

/**
 * Export a public key JWK to a base64 string for storage/transfer.
 */
export function exportPublicKey(jwk: JsonWebKey): string {
  return btoa(JSON.stringify(jwk));
}

/**
 * Import a base64 JWK string back to a CryptoKey.
 */
export async function importPublicKey(base64Jwk: string): Promise<CryptoKey> {
  const jwk: JsonWebKey = JSON.parse(atob(base64Jwk));
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * Import a JWK object as a private CryptoKey.
 */
export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// ─── Document Encryption (Envelope Key) ──────────────────────────────────────

/**
 * Encrypt a document with a random AES-256-GCM envelope key.
 * Returns the ciphertext, IV, and the raw envelope key (for wrapping).
 */
export async function encryptDocument(plaintext: ArrayBuffer): Promise<{
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  envelopeKey: Uint8Array;
}> {
  // Generate random 256-bit envelope key
  const envelopeKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    plaintext
  );

  return { ciphertext, iv, envelopeKey };
}

/**
 * Decrypt a document using the envelope key.
 */
export async function decryptDocument(
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  envelopeKey: Uint8Array
): Promise<ArrayBuffer> {
  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    ciphertext
  );
}

// ─── Key Wrapping (ECDH + HKDF + AES-KW) ────────────────────────────────────

const HKDF_INFO = new TextEncoder().encode('bit-sign-e2e-v2');
const HKDF_SALT = new Uint8Array(32); // zero salt — acceptable for ECDH-derived input

/**
 * Derive an AES-256 wrapping key from ECDH shared secret via HKDF.
 */
async function deriveWrappingKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  // ECDH key agreement → shared bits
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );

  // Import shared bits as HKDF key material
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  // HKDF → AES-KW wrapping key
  return await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Wrap an envelope key for a specific recipient using ECDH.
 *
 * @param envelopeKey - The raw 256-bit document encryption key
 * @param senderPrivateKey - Sender's ECDH private key
 * @param recipientPublicKey - Recipient's ECDH public key
 * @returns The wrapped key bytes + sender's public key (for recipient to unwrap)
 */
export async function wrapKeyForRecipient(
  envelopeKey: Uint8Array,
  senderPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<{
  wrappedKey: ArrayBuffer;
  senderPublicKey: JsonWebKey;
}> {
  const wrappingKey = await deriveWrappingKey(senderPrivateKey, recipientPublicKey);

  // Import envelope key as a CryptoKey so we can use wrapKey
  const envelopeCryptoKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    true, // must be extractable for wrapping
    ['encrypt', 'decrypt']
  );

  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    envelopeCryptoKey,
    wrappingKey,
    'AES-KW'
  );

  // Export sender's public key so recipient can perform the same ECDH
  const senderPublicKey = await crypto.subtle.exportKey(
    'jwk',
    await getPublicKeyFromPrivate(senderPrivateKey)
  );

  return { wrappedKey, senderPublicKey };
}

/**
 * Unwrap an envelope key using ECDH with the sender's public key.
 *
 * @param wrappedKey - The AES-KW wrapped envelope key
 * @param recipientPrivateKey - Recipient's ECDH private key
 * @param senderPublicKey - Sender's ECDH public key (from the grant)
 * @returns The raw 256-bit envelope key
 */
export async function unwrapKey(
  wrappedKey: ArrayBuffer,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<Uint8Array> {
  const wrappingKey = await deriveWrappingKey(recipientPrivateKey, senderPublicKey);

  const unwrapped = await crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const raw = await crypto.subtle.exportKey('raw', unwrapped);
  return new Uint8Array(raw);
}

// ─── Private Key Protection ──────────────────────────────────────────────────

/**
 * Derive a protection key from a HandCash data signature.
 * Used to encrypt the user's private key before server storage.
 */
export async function deriveProtectionKey(
  handcashSignature: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const signatureBytes = encoder.encode(handcashSignature);
  const hashBuffer = await crypto.subtle.digest('SHA-256', signatureBytes);

  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a private key JWK for server-side backup.
 */
export async function encryptPrivateKey(
  privateKey: JsonWebKey,
  protectionKey: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(privateKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    protectionKey,
    data
  );

  return { encrypted, iv };
}

/**
 * Decrypt a private key JWK from server backup.
 */
export async function decryptPrivateKey(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  protectionKey: CryptoKey
): Promise<JsonWebKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    protectionKey,
    encrypted
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the public key component from a private key.
 * (Re-imports with only the public components of the JWK)
 */
async function getPublicKeyFromPrivate(privateKey: CryptoKey): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  // Remove private component to create public-only JWK
  const { d: _, ...publicJwk } = jwk;
  return await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}
