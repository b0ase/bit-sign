'use client';

import { useState } from 'react';
import { FiX, FiShare2, FiCheck, FiLoader, FiAlertCircle } from 'react-icons/fi';
import {
    importPublicKey,
    importPrivateKey,
    wrapKeyForRecipient,
    deriveProtectionKey,
    decryptPrivateKey,
    bufferToBase64,
    base64ToBuffer,
} from '@/lib/e2e-crypto';

interface ShareModalProps {
    documentId: string;
    documentType: string;
    onClose: () => void;
}

export default function ShareModal({ documentId, documentType, onClose }: ShareModalProps) {
    const [handle, setHandle] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleShare = async () => {
        if (!handle.trim()) return;

        setIsSharing(true);
        setError(null);

        try {
            // 1. Fetch recipient's public key
            const cleanHandle = handle.replace(/^\$/, '');
            const recipientRes = await fetch(`/api/bitsign/public-key/${cleanHandle}`);
            if (!recipientRes.ok) {
                const data = await recipientRes.json();
                throw new Error(data.error || 'Recipient not found');
            }
            const { public_key: recipientPublicKeyBase64 } = await recipientRes.json();

            // 2. Get our own keypair
            const keypairRes = await fetch('/api/bitsign/keypair');
            if (!keypairRes.ok) throw new Error('Failed to load your keypair');
            const keypairData = await keypairRes.json();

            if (!keypairData.encrypted_private_key || !keypairData.private_key_iv) {
                throw new Error('E2E encryption not set up. Please set it up first.');
            }

            // 3. Unlock our private key using HandCash signature
            const verifyRes = await fetch('/api/bitsign/handcash-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'BIT-SIGN E2E KEY PROTECTION' }),
            });
            if (!verifyRes.ok) throw new Error('Failed to verify with HandCash');
            const { signature: handcashSignature } = await verifyRes.json();

            const protectionKey = await deriveProtectionKey(handcashSignature);
            const privateKeyJwk = await decryptPrivateKey(
                base64ToBuffer(keypairData.encrypted_private_key) as ArrayBuffer,
                new Uint8Array(base64ToBuffer(keypairData.private_key_iv) as ArrayBuffer),
                protectionKey
            );

            // 4. Get the document's encrypted payload to extract envelope key
            //    For v1 items, we need the encryption seed to derive the envelope key
            const seedRes = await fetch('/api/bitsign/encryption-seed');
            if (!seedRes.ok) throw new Error('Failed to get encryption seed');
            const { encryptionSeed } = await seedRes.json();

            // Derive the v1 encryption key as the "envelope key" for wrapping
            const encoder = new TextEncoder();
            const seedBytes = encoder.encode(encryptionSeed);
            const hashBuffer = await crypto.subtle.digest('SHA-256', seedBytes);
            const envelopeKey = new Uint8Array(hashBuffer);

            // 5. Wrap the envelope key for the recipient
            const senderPrivateKey = await importPrivateKey(privateKeyJwk);
            const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);

            const { wrappedKey, senderPublicKey } = await wrapKeyForRecipient(
                envelopeKey,
                senderPrivateKey,
                recipientPublicKey
            );

            // 6. Create the access grant on the server
            const shareRes = await fetch('/api/bitsign/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: documentId,
                    document_type: documentType,
                    grantee_handle: cleanHandle,
                    wrapped_key: bufferToBase64(wrappedKey),
                    ephemeral_public_key: btoa(JSON.stringify(senderPublicKey)),
                }),
            });

            if (!shareRes.ok) {
                const data = await shareRes.json();
                throw new Error(data.error || 'Failed to share');
            }

            setSuccess(true);
        } catch (err: any) {
            console.error('Share failed:', err);
            setError(err?.message || 'Failed to share. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-md p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiShare2 size={18} /> Share Document
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white transition-colors"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {success ? (
                    <div className="text-center py-8 space-y-3">
                        <div className="w-12 h-12 bg-green-950/30 border border-green-800 rounded-full flex items-center justify-center mx-auto">
                            <FiCheck className="text-green-400" size={20} />
                        </div>
                        <p className="text-sm text-green-400 font-medium">
                            Shared with ${handle.replace(/^\$/, '')}
                        </p>
                        <p className="text-xs text-zinc-500">
                            They can now decrypt this document in their vault.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-4 px-5 py-2 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-md hover:bg-zinc-800 transition-all"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className="block text-xs text-zinc-400">
                                Recipient HandCash Handle
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                                <input
                                    type="text"
                                    value={handle}
                                    onChange={(e) => setHandle(e.target.value)}
                                    placeholder="handle"
                                    className="w-full pl-7 pr-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                                    onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 text-red-400 text-xs">
                                <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <p className="text-xs text-zinc-500 leading-relaxed">
                            The document will be encrypted specifically for this recipient using
                            ECDH key agreement. Only they can decrypt it with their private key.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleShare}
                                disabled={isSharing || !handle.trim()}
                                className="flex-1 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSharing ? (
                                    <>
                                        <FiLoader className="animate-spin" size={14} />
                                        Sharing...
                                    </>
                                ) : (
                                    <>
                                        <FiShare2 size={14} />
                                        Share
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
