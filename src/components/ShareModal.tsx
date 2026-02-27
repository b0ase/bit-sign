'use client';

import { useState } from 'react';
import { FiX, FiShare2, FiCheck, FiLoader, FiAlertCircle, FiMail } from 'react-icons/fi';
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
    itemType?: string;
    itemLabel?: string;
    onClose: () => void;
}

type ShareTab = 'handle' | 'email';

export default function ShareModal({ documentId, documentType, itemType, itemLabel, onClose }: ShareModalProps) {
    const [tab, setTab] = useState<ShareTab>('handle');
    const [handle, setHandle] = useState('');
    const [email, setEmail] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [sendCopy, setSendCopy] = useState(false);
    const [ccEmail, setCcEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

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

            setSuccessMessage(`Shared with $${handle.replace(/^\$/, '')}`);
            setSuccess(true);
        } catch (err: any) {
            console.error('Share failed:', err);
            setError(err?.message || 'Failed to share. Check the handle and try again.');
        } finally {
            setIsSharing(false);
        }
    };

    const handleEmailInvite = async () => {
        if (!email.trim()) return;

        setIsSharing(true);
        setError(null);

        try {
            const res = await fetch('/api/bitsign/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId,
                    recipientEmail: email.trim(),
                    message: emailMessage.trim() || undefined,
                    ccEmail: sendCopy && ccEmail.trim() ? ccEmail.trim() : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send invite');
            }

            if (data.warning) {
                // Invite created but email failed — show warning
                setError(`Email delivery failed. ${data.warning}`);
            } else {
                setSuccessMessage(`Invitation sent to ${email}`);
                setSuccess(true);
            }
        } catch (err: any) {
            console.error('Email invite failed:', err);
            setError(err?.message || 'Failed to send invite. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-md p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiShare2 size={18} /> Share
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
                            {successMessage}
                        </p>
                        <p className="text-xs text-zinc-500">
                            {tab === 'handle'
                                ? 'They can now decrypt this document in their vault.'
                                : 'They\'ll receive an email with a link to view it.'}
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
                        {/* Tab toggle */}
                        <div className="flex bg-black border border-zinc-800 rounded-md p-0.5">
                            <button
                                onClick={() => { setTab('handle'); setError(null); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-[5px] transition-all flex items-center justify-center gap-1.5 ${
                                    tab === 'handle'
                                        ? 'bg-zinc-800 text-white'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <FiShare2 size={13} /> Handle
                            </button>
                            <button
                                onClick={() => { setTab('email'); setError(null); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-[5px] transition-all flex items-center justify-center gap-1.5 ${
                                    tab === 'email'
                                        ? 'bg-zinc-800 text-white'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <FiMail size={13} /> Email
                            </button>
                        </div>

                        {/* Handle tab */}
                        {tab === 'handle' && (
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

                        {/* Email tab */}
                        {tab === 'email' && (
                            <>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs text-zinc-400">
                                            Recipient Email
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="alice@example.com"
                                            className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleEmailInvite()}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs text-zinc-400">
                                            Message <span className="text-zinc-600">(optional)</span>
                                        </label>
                                        <textarea
                                            value={emailMessage}
                                            onChange={(e) => setEmailMessage(e.target.value)}
                                            placeholder="Hey, check this out!"
                                            rows={2}
                                            className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={sendCopy}
                                                onChange={(e) => setSendCopy(e.target.checked)}
                                                className="accent-white"
                                            />
                                            <span className="text-xs text-zinc-400">Send me a copy</span>
                                        </label>
                                        {sendCopy && (
                                            <input
                                                type="email"
                                                value={ccEmail}
                                                onChange={(e) => setCcEmail(e.target.value)}
                                                placeholder="your@email.com"
                                                className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                                            />
                                        )}
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2 text-red-400 text-xs">
                                        <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                                        {error}
                                    </div>
                                )}

                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    They'll receive an email with a link. If they don't have HandCash yet,
                                    they'll be guided through a 30-second signup.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 px-4 py-2.5 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleEmailInvite}
                                        disabled={isSharing || !email.trim()}
                                        className="flex-1 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSharing ? (
                                            <>
                                                <FiLoader className="animate-spin" size={14} />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <FiMail size={14} />
                                                Send Invite
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
