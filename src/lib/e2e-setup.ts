import {
    generateKeyPair,
    exportPublicKey,
    deriveProtectionKey,
    encryptPrivateKey,
    bufferToBase64,
} from '@/lib/e2e-crypto';

/**
 * Runs the full E2E keypair setup flow:
 * 1. Generate ECDH keypair client-side
 * 2. Sign challenge with HandCash to derive protection key
 * 3. Encrypt private key with protection key
 * 4. Upload public key + encrypted private key to server
 */
export async function setupE2EKeys(): Promise<void> {
    // 1. Generate ECDH keypair client-side
    const { publicKey, privateKey } = await generateKeyPair();

    // 2. Sign a challenge with HandCash to derive protection key
    const challengeRes = await fetch('/api/bitsign/handcash-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: 'BIT-SIGN E2E KEY PROTECTION',
        }),
    });

    if (!challengeRes.ok) {
        throw new Error('Failed to sign with HandCash wallet');
    }

    const { signature: handcashSignature } = await challengeRes.json();

    // 3. Derive protection key from HandCash signature
    const protectionKey = await deriveProtectionKey(handcashSignature);

    // 4. Encrypt private key with protection key
    const { encrypted, iv } = await encryptPrivateKey(privateKey, protectionKey);

    // 5. Upload public key + encrypted private key to server
    const storeRes = await fetch('/api/bitsign/keypair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            public_key: exportPublicKey(publicKey),
            encrypted_private_key: bufferToBase64(encrypted),
            private_key_iv: bufferToBase64(iv.buffer),
        }),
    });

    if (!storeRes.ok) {
        throw new Error('Failed to store keypair');
    }
}
