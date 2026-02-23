'use client';

import { useState } from 'react';
import { FiLock, FiCheck, FiLoader } from 'react-icons/fi';
import {
    generateKeyPair,
    exportPublicKey,
    deriveProtectionKey,
    encryptPrivateKey,
    bufferToBase64,
} from '@/lib/e2e-crypto';

interface E2ESetupBannerProps {
    onSetupComplete: () => void;
}

export default function E2ESetupBanner({ onSetupComplete }: E2ESetupBannerProps) {
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSetup = async () => {
        setIsSettingUp(true);
        setError(null);

        try {
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

            onSetupComplete();
        } catch (err: any) {
            console.error('E2E setup failed:', err);
            setError(err?.message || 'Setup failed. Please try again.');
        } finally {
            setIsSettingUp(false);
        }
    };

    return (
        <div className="border border-blue-900/40 bg-blue-950/10 rounded-md p-6 space-y-4">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-950/50 border border-blue-900/30 rounded-md flex items-center justify-center shrink-0">
                    <FiLock className="text-blue-400" size={18} />
                </div>
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Set Up End-to-End Encryption</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
                        Generate a keypair to enable encrypted document sharing. Your private key is protected
                        by your HandCash wallet signature and never stored in plaintext on the server.
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-xs text-red-400 pl-14">{error}</p>
            )}

            <div className="pl-14">
                <button
                    onClick={handleSetup}
                    disabled={isSettingUp}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSettingUp ? (
                        <>
                            <FiLoader className="animate-spin" size={14} />
                            Setting up...
                        </>
                    ) : (
                        <>
                            <FiCheck size={14} />
                            Enable E2E Encryption
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
