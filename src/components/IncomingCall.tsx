'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiPhone, FiPhoneOff } from 'react-icons/fi';

interface IncomingCallProps {
    callId: string;
    callerHandle: string;
    createdAt: string;
    onAccept: (roomToken: string) => void;
    onDecline: () => void;
}

export default function IncomingCall({ callId, callerHandle, createdAt, onAccept, onDecline }: IncomingCallProps) {
    const [responding, setResponding] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    // Track elapsed time and auto-dismiss after 60s
    useEffect(() => {
        const start = new Date(createdAt).getTime();
        const tick = () => {
            const now = Date.now();
            const secs = Math.floor((now - start) / 1000);
            setElapsed(secs);
            if (secs >= 60) {
                onDecline();
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [createdAt, onDecline]);

    const handleAccept = useCallback(async () => {
        setResponding(true);
        try {
            const res = await fetch(`/api/bitsign/call/${callId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept' }),
            });
            const data = await res.json();
            if (res.ok && data.roomToken) {
                onAccept(data.roomToken);
            }
        } catch {
            // Silently fail — call might have expired
        } finally {
            setResponding(false);
        }
    }, [callId, onAccept]);

    const handleDecline = useCallback(async () => {
        setResponding(true);
        try {
            await fetch(`/api/bitsign/call/${callId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject' }),
            });
        } catch {
            // Silently fail
        }
        onDecline();
    }, [callId, onDecline]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-6">
                {/* Pulsing ring animation */}
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-green-500/30 animate-pulse" />
                    <div className="absolute inset-4 rounded-full bg-zinc-800 border-2 border-green-500 flex items-center justify-center">
                        <FiPhone className="text-green-400" size={24} />
                    </div>
                </div>

                <div>
                    <p className="text-lg font-medium text-white">Incoming Call</p>
                    <p className="text-green-400 font-mono text-sm mt-1">${callerHandle}</p>
                    <p className="text-xs text-zinc-500 mt-2">{60 - elapsed}s remaining</p>
                </div>

                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={handleDecline}
                        disabled={responding}
                        className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                        <FiPhoneOff size={24} />
                    </button>
                    <button
                        onClick={handleAccept}
                        disabled={responding}
                        className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                        <FiPhone size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}
