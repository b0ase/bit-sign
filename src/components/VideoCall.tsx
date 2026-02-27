'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FiPhoneOff, FiMaximize2, FiMinimize2, FiCopy, FiCheck } from 'react-icons/fi';

declare global {
    interface Window {
        JitsiMeetExternalAPI: any;
    }
}

interface VideoCallProps {
    roomToken: string;
    displayName: string;
    onClose: () => void;
    documentName?: string;
}

export default function VideoCall({ roomToken, displayName, onClose, documentName }: VideoCallProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<any>(null);
    const [loaded, setLoaded] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [participants, setParticipants] = useState(0);
    const [copied, setCopied] = useState(false);

    const roomName = `BitSign-${roomToken}`;
    const callUrl = typeof window !== 'undefined' ? `${window.location.origin}/call/${roomToken}` : '';

    // Stable close handler
    const handleClose = useCallback(() => { onClose(); }, [onClose]);

    useEffect(() => {
        // Check if already loaded
        if (window.JitsiMeetExternalAPI) {
            setLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => setLoaded(true);
        document.head.appendChild(script);

        return () => {
            if (apiRef.current) {
                apiRef.current.dispose();
                apiRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!loaded || !containerRef.current || apiRef.current) return;

        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
            roomName,
            parentNode: containerRef.current,
            userInfo: { displayName },
            configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoOn: true,
                disableDeepLinking: true,
                prejoinConfig: { enabled: true },
                disableThirdPartyRequests: true,
                hideConferenceSubject: false,
                subject: documentName ? `Signing: ${documentName}` : 'Bit-Sign Live Signing',
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'fullscreen', 'tileview', 'chat', 'settings'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_BRAND_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                DEFAULT_BACKGROUND: '#050505',
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                FILM_STRIP_MAX_HEIGHT: 120,
                TOOLBAR_ALWAYS_VISIBLE: true,
            },
        });

        apiRef.current = api;

        // Ensure the Jitsi iframe has camera/mic permissions
        const iframe = containerRef.current?.querySelector('iframe');
        if (iframe) {
            iframe.setAttribute('allow', 'camera *; microphone *; display-capture *; autoplay *');
        }

        api.addListener('participantJoined', () => {
            setParticipants((prev: number) => prev + 1);
        });
        api.addListener('participantLeft', () => {
            setParticipants((prev: number) => Math.max(0, prev - 1));
        });
        api.addListener('readyToClose', () => {
            handleClose();
        });

        return () => {
            api.dispose();
            apiRef.current = null;
        };
    }, [loaded, roomName, displayName, documentName, handleClose]);

    const copyLink = () => {
        navigator.clipboard.writeText(callUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`fixed z-50 transition-all duration-300 ${
            expanded
                ? 'inset-4 rounded-xl'
                : 'bottom-6 right-6 w-[400px] h-[340px] rounded-xl'
        } bg-black border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden flex flex-col`}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-zinc-400">
                        Live Signing Call
                        {participants > 0 && <span className="text-green-400 ml-1">({participants + 1} in call)</span>}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={copyLink}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                        title="Copy invite link"
                    >
                        {copied ? <FiCheck size={12} className="text-green-400" /> : <FiCopy size={12} />}
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                        title={expanded ? 'Minimize' : 'Expand'}
                    >
                        {expanded ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                        title="End call"
                    >
                        <FiPhoneOff size={12} />
                    </button>
                </div>
            </div>

            {/* Call link bar */}
            <div className="px-3 py-1.5 bg-zinc-950/50 border-b border-zinc-900 flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-600 truncate flex-1 font-mono">{callUrl}</span>
                <button onClick={copyLink} className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0">
                    {copied ? 'Copied!' : 'Copy & send to signer'}
                </button>
            </div>

            {/* Video container */}
            {!loaded ? (
                <div className="flex-1 flex items-center justify-center bg-[#050505]">
                    <div className="text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-zinc-500">Connecting video...</p>
                    </div>
                </div>
            ) : (
                <div ref={containerRef} className="flex-1 bg-[#050505] relative" />
            )}

            {/* Floating controls — always visible even in expanded/fullscreen mode */}
            {expanded && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 border border-zinc-700/50">
                    <button
                        onClick={() => setExpanded(false)}
                        className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                        title="Minimize"
                    >
                        <FiMinimize2 size={14} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                        title="End call"
                    >
                        <FiPhoneOff size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
