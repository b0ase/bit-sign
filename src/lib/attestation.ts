/**
 * Sovereign Attestation Utilities
 * Handles client-side encryption/decryption using HandCash signatures
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const SEED_PHRASE = "BIT-SIGN_SAFE_BOX_KEY_SEED";

/**
 * Derives an encryption key from a HandCash signature
 */
export async function deriveKeyFromSignature(signature: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const signatureBytes = encoder.encode(signature);

    // Hash the signature to get a fixed-length key source
    const hashBuffer = await crypto.subtle.digest('SHA-256', signatureBytes);

    return await crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a file (BufferSource) using a HandCash signature
 */
export async function encryptDocument(data: BufferSource, signature: string): Promise<{ encryptedData: ArrayBuffer, iv: Uint8Array }> {
    const key = await deriveKeyFromSignature(signature);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    const encryptedData = await crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGORITHM, iv: iv as any },
        key,
        data
    );

    return { encryptedData, iv };
}

/**
 * Decrypts a document using a HandCash signature
 */
export async function decryptDocument(encryptedData: BufferSource, iv: Uint8Array, signature: string): Promise<ArrayBuffer> {
    const key = await deriveKeyFromSignature(signature);

    return await crypto.subtle.decrypt(
        { name: ENCRYPTION_ALGORITHM, iv: iv as any },
        key,
        encryptedData
    );
}

/**
 * Helper to convert ArrayBuffer to Base64
 */
export function bufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Helper to convert Base64 to ArrayBuffer
 */
export function base64ToBuffer(base64: string): ArrayBufferLike {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export { SEED_PHRASE };
