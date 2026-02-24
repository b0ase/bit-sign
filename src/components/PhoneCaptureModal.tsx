'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiSmartphone, FiRefreshCw } from 'react-icons/fi';
import QRCode from 'qrcode';

interface PhoneCaptureModalProps {
    mode: 'PHOTO' | 'VIDEO';
    onCapture: (blob: Blob) => void;
    onCancel: () => void;
}

export default function PhoneCaptureModal({ mode, onCapture, onCancel }: PhoneCaptureModalProps) {
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [status, setStatus] = useState<'creating' | 'waiting' | 'captured' | 'expired' | 'error'>('creating');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const createSession = useCallback(async () => {
        setStatus('creating');
        setErrorMsg(null);
        try {
            const res = await fetch('/api/bitsign/capture-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ captureMode: mode }),
            });
            if (!res.ok) throw new Error('Failed to create session');
            const data = await res.json();

            setSessionToken(data.sessionToken);
            setExpiresAt(new Date(data.expiresAt));

            // Generate QR code
            const captureUrl = `${window.location.origin}/capture/${data.sessionToken}`;
            const dataUrl = await QRCode.toDataURL(captureUrl, {
                width: 280,
                margin: 2,
                color: { dark: '#ffffff', light: '#00000000' },
            });
            setQrDataUrl(dataUrl);
            setStatus('waiting');

            // Calculate time left
            const expiry = new Date(data.expiresAt);
            const secondsLeft = Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000));
            setTimeLeft(secondsLeft);
        } catch (err) {
            console.error('[PhoneCaptureModal] Create session error:', err);
            setStatus('error');
            setErrorMsg('Failed to create capture session. Please try again.');
        }
    }, [mode]);

    // Create session on mount
    useEffect(() => {
        createSession();
    }, [createSession]);

    // Countdown timer
    useEffect(() => {
        if (status !== 'waiting') return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setStatus('expired');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [status]);

    // Poll for captured media
    useEffect(() => {
        if (status !== 'waiting' || !sessionToken) return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/bitsign/capture-session/${sessionToken}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.status === 'captured' && data.mediaData) {
                    setStatus('captured');
                    // Convert base64 to blob
                    const binary = atob(data.mediaData);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: data.mediaMimeType || 'image/jpeg' });
                    onCapture(blob);
                } else if (data.status === 'expired') {
                    setStatus('expired');
                }
            } catch {
                // Polling error — non-fatal, will retry
            }
        }, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [status, sessionToken, onCapture]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleRetry = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionToken(null);
        setQrDataUrl(null);
        setTimeLeft(300);
        createSession();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-zinc-900/50 border border-white/[0.05] rounded-sm overflow-hidden flex flex-col relative">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/50 text-white hover:bg-white hover:text-black transition-all rounded-full"
                >
                    <FiX size={18} />
                </button>

                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="flex items-center gap-3">
                        <FiSmartphone className="text-zinc-400" size={24} />
                        <h2 className="text-lg font-medium text-white">
                            {mode === 'PHOTO' ? 'Take Photo' : 'Record Video'} with Phone
                        </h2>
                    </div>

                    {status === 'creating' && (
                        <div className="py-12">
                            <div className="w-10 h-10 border-t-2 border-white animate-spin rounded-full opacity-20 mx-auto" />
                            <p className="text-sm text-zinc-500 mt-4">Creating session...</p>
                        </div>
                    )}

                    {status === 'waiting' && qrDataUrl && (
                        <>
                            <p className="text-sm text-zinc-400">
                                Scan this QR code with your phone camera
                            </p>

                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                                <img
                                    src={qrDataUrl}
                                    alt="Scan with phone"
                                    className="w-[280px] h-[280px]"
                                />
                            </div>

                            <div className={`text-sm font-mono ${timeLeft <= 60 ? 'text-red-400' : 'text-zinc-400'}`}>
                                Expires in {formatTime(timeLeft)}
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs text-zinc-500">Waiting for capture...</span>
                            </div>
                        </>
                    )}

                    {status === 'expired' && (
                        <div className="py-8 space-y-4">
                            <p className="text-sm text-zinc-400">Session expired</p>
                            <button
                                onClick={handleRetry}
                                className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2 mx-auto"
                            >
                                <FiRefreshCw size={14} /> Generate New QR
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-8 space-y-4">
                            <p className="text-sm text-red-400">{errorMsg}</p>
                            <button
                                onClick={handleRetry}
                                className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2 mx-auto"
                            >
                                <FiRefreshCw size={14} /> Retry
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
