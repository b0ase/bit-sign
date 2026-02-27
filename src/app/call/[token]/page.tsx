'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { FiShield, FiVideo, FiLock, FiGithub } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';

declare global {
    interface Window {
        JitsiMeetExternalAPI: any;
    }
}

export default function CallPage() {
    const { token } = useParams<{ token: string }>();
    const containerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<any>(null);
    const [loaded, setLoaded] = useState(false);
    const [handle, setHandle] = useState<string | null>(null);
    const [joined, setJoined] = useState(false);
    const [ended, setEnded] = useState(false);

    const returnTo = `/call/${token}`;

    useEffect(() => {
        const cookies = document.cookie.split('; ');
        const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
        if (handleCookie) {
            setHandle(handleCookie.split('=')[1]);
        }
    }, []);

    useEffect(() => {
        if (window.JitsiMeetExternalAPI) {
            setLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => setLoaded(true);
        document.head.appendChild(script);
    }, []);

    const joinCall = () => {
        if (!loaded || !containerRef.current || !token) return;

        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
            roomName: `BitSign-${token}`,
            parentNode: containerRef.current,
            userInfo: { displayName: handle || 'Guest' },
            width: '100%',
            height: '100%',
            configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoOn: true,
                disableDeepLinking: true,
                prejoinConfig: { enabled: true },
                subject: 'Bit-Sign Live Signing',
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'fullscreen', 'chat', 'tileview', 'raisehand'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_BRAND_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                DEFAULT_BACKGROUND: '#050505',
                TOOLBAR_ALWAYS_VISIBLE: true,
            },
        });

        apiRef.current = api;
        setJoined(true);

        api.addListener('readyToClose', () => {
            setJoined(false);
            setEnded(true);
            if (apiRef.current) {
                apiRef.current.dispose();
                apiRef.current = null;
            }
        });
    };

    if (ended) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center space-y-4">
                    <FiShield className="mx-auto text-amber-500" size={40} />
                    <h2 className="text-xl font-semibold">Call Ended</h2>
                    <p className="text-sm text-zinc-400">The signing session has concluded.</p>
                    <a
                        href="/user/account"
                        className="inline-block px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-lg transition-colors"
                    >
                        Go to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {!joined ? (
                <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <FiShield className="text-amber-500" size={32} />
                        <h1 className="text-2xl font-bold tracking-tight">Bit-Sign</h1>
                    </div>

                    {/* Join card */}
                    <div className="w-full max-w-md p-8 rounded-xl border border-zinc-800 bg-zinc-950 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center mx-auto mb-4">
                                <FiVideo className="text-blue-400" size={28} />
                            </div>
                            <h2 className="text-lg font-semibold">Live Signing Call</h2>
                            <p className="text-sm text-zinc-400">
                                You&apos;ve been invited to a live document signing session on Bit-Sign.
                            </p>
                        </div>

                        {/* Security badge */}
                        <div className="flex items-start gap-3 text-xs text-zinc-500 bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                            <FiLock size={16} className="text-green-400 shrink-0 mt-0.5" />
                            <div>
                                <span className="text-green-400 font-medium">Encrypted</span>
                                <span className="text-zinc-500"> &mdash; Video is peer-to-peer with DTLS-SRTP encryption. Your stream never touches Bit-Sign servers.</span>
                            </div>
                        </div>

                        {handle ? (
                            <>
                                <p className="text-xs text-zinc-500 text-center">
                                    Joining as <span className="text-white font-medium">${handle}</span>
                                </p>

                                <button
                                    onClick={joinCall}
                                    disabled={!loaded}
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait"
                                >
                                    {loaded ? (
                                        <><FiVideo size={16} /> Join Signing Call</>
                                    ) : (
                                        <><span className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" /> Connecting...</>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2.5">
                                    <p className="text-xs text-zinc-500 text-center mb-3">Sign in to join with your identity verified</p>

                                    <a
                                        href={`/api/auth/handcash?returnTo=${encodeURIComponent(returnTo)}`}
                                        className="w-full py-2.5 px-4 bg-white text-black font-medium rounded-lg flex items-center justify-center gap-2.5 hover:bg-neutral-200 transition-colors text-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#38CB7C"/><path d="M10 16.5L14 20.5L22 12.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        Sign in with HandCash
                                    </a>

                                    <a
                                        href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
                                        className="w-full py-2.5 px-4 bg-zinc-900 border border-zinc-800 text-white font-medium rounded-lg flex items-center justify-center gap-2.5 hover:bg-zinc-800 transition-colors text-sm"
                                    >
                                        <FcGoogle size={18} />
                                        Sign in with Google
                                    </a>

                                    <a
                                        href={`/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`}
                                        className="w-full py-2.5 px-4 bg-zinc-900 border border-zinc-800 text-white font-medium rounded-lg flex items-center justify-center gap-2.5 hover:bg-zinc-800 transition-colors text-sm"
                                    >
                                        <FiGithub size={18} />
                                        Sign in with GitHub
                                    </a>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
                                    <div className="relative flex justify-center"><span className="bg-zinc-950 px-3 text-[10px] text-zinc-600">or</span></div>
                                </div>

                                <button
                                    onClick={joinCall}
                                    disabled={!loaded}
                                    className="w-full py-2.5 px-4 bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white text-sm cursor-pointer disabled:cursor-wait disabled:opacity-50"
                                >
                                    {loaded ? (
                                        <><FiVideo size={14} /> Join as Guest</>
                                    ) : (
                                        <><span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" /> Loading...</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <p className="text-[10px] text-zinc-700 mt-8">
                        Powered by Bit-Sign &middot; Document Signing on Bitcoin
                    </p>
                </div>
            ) : (
                <div ref={containerRef} className="w-full h-screen" />
            )}
        </div>
    );
}
