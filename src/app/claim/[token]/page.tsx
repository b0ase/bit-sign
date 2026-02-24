'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiCheck, FiAlertCircle, FiShare2 } from 'react-icons/fi';

interface InviteInfo {
    senderHandle: string;
    itemType: string;
    itemLabel: string;
    message: string | null;
    createdAt: string;
}

type ClaimState = 'loading' | 'unauthenticated' | 'claiming' | 'success' | 'error' | 'gone';

export default function ClaimPage() {
    const { token } = useParams<{ token: string }>();
    const router = useRouter();
    const [state, setState] = useState<ClaimState>('loading');
    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [error, setError] = useState<string>('');
    const [handle, setHandle] = useState<string | null>(null);

    // Check auth on mount
    useEffect(() => {
        const cookies = document.cookie.split('; ');
        const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
        if (handleCookie) {
            setHandle(handleCookie.split('=')[1]);
        }
    }, []);

    // Fetch invite info
    useEffect(() => {
        if (!token) return;

        fetch(`/api/bitsign/claim/${token}`)
            .then(async (res) => {
                if (res.status === 410) {
                    setState('gone');
                    return;
                }
                if (!res.ok) {
                    setState('gone');
                    return;
                }
                const data = await res.json();
                setInvite(data);

                // If authenticated, auto-claim
                if (handle) {
                    setState('claiming');
                } else {
                    setState('unauthenticated');
                }
            })
            .catch(() => {
                setState('gone');
            });
    }, [token, handle]);

    // Auto-claim when authenticated
    useEffect(() => {
        if (state !== 'claiming' || !token) return;

        fetch(`/api/bitsign/claim/${token}`, { method: 'POST' })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok && data.success) {
                    setState('success');
                    setTimeout(() => router.push('/user/account'), 2000);
                } else {
                    setError(data.error || 'Failed to claim');
                    setState(data.error?.includes('already') ? 'gone' : 'error');
                }
            })
            .catch(() => {
                setError('Network error');
                setState('error');
            });
    }, [state, token, router]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Loading */}
                {state === 'loading' && (
                    <div className="text-center py-20">
                        <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full mx-auto mb-4" />
                        <p className="text-sm text-zinc-500">Loading invite...</p>
                    </div>
                )}

                {/* Gone / Already claimed */}
                {state === 'gone' && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center space-y-4">
                        <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto">
                            <FiAlertCircle className="text-zinc-500" size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Link Unavailable</h2>
                        <p className="text-sm text-zinc-500">
                            This link has already been used or has expired.
                        </p>
                        <a
                            href="/"
                            className="inline-block mt-4 px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-md hover:bg-zinc-800 transition-all"
                        >
                            Go to Bit-Sign
                        </a>
                    </div>
                )}

                {/* Unauthenticated — show sign in */}
                {state === 'unauthenticated' && invite && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiShare2 className="text-white" size={20} />
                            </div>
                            <h2 className="text-lg font-semibold text-white">
                                You've received a {invite.itemLabel}
                            </h2>
                            <p className="text-sm text-zinc-400">
                                from <span className="text-white font-medium">${invite.senderHandle}</span>
                            </p>
                        </div>

                        {invite.message && (
                            <div className="border-l-2 border-zinc-700 pl-4 py-2">
                                <p className="text-xs text-zinc-500 mb-1">Personal Message</p>
                                <p className="text-sm text-zinc-300 leading-relaxed">{invite.message}</p>
                            </div>
                        )}

                        <a
                            href={`/api/auth/handcash?returnTo=/claim/${token}`}
                            className="block w-full px-4 py-3 bg-white text-black text-sm font-semibold rounded-md hover:bg-zinc-200 transition-all text-center"
                        >
                            Sign in with HandCash
                        </a>

                        <p className="text-xs text-zinc-600 text-center leading-relaxed">
                            Don't have HandCash? No problem — you'll create one in 30 seconds.
                        </p>
                    </div>
                )}

                {/* Claiming */}
                {state === 'claiming' && (
                    <div className="text-center py-20">
                        <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full mx-auto mb-4" />
                        <p className="text-sm text-zinc-400">Adding to your vault...</p>
                    </div>
                )}

                {/* Success */}
                {state === 'success' && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center space-y-4">
                        <div className="w-12 h-12 bg-green-950/30 border border-green-800 rounded-full flex items-center justify-center mx-auto">
                            <FiCheck className="text-green-400" size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Added to your vault!</h2>
                        <p className="text-sm text-zinc-500">
                            Redirecting to your account...
                        </p>
                    </div>
                )}

                {/* Error */}
                {state === 'error' && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center space-y-4">
                        <div className="w-12 h-12 bg-red-950/30 border border-red-800 rounded-full flex items-center justify-center mx-auto">
                            <FiAlertCircle className="text-red-400" size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
                        <p className="text-sm text-zinc-500">{error}</p>
                        <button
                            onClick={() => setState('claiming')}
                            className="mt-4 px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-md hover:bg-zinc-800 transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
