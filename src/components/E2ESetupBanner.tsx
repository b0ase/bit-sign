'use client';

import { useState } from 'react';
import { FiLock, FiCheck, FiLoader } from 'react-icons/fi';
import { setupE2EKeys } from '@/lib/e2e-setup';

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
            await setupE2EKeys();
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
