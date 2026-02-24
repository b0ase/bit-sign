'use client';

import React, { useState, useEffect, use } from 'react';
import MediaCapture from '@/components/MediaCapture';
import { FiCheck, FiAlertCircle, FiLoader } from 'react-icons/fi';

export default function CapturePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [status, setStatus] = useState<'loading' | 'ready' | 'uploading' | 'success' | 'error' | 'expired'>('loading');
    const [captureMode, setCaptureMode] = useState<'PHOTO' | 'VIDEO'>('PHOTO');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        validateSession();
    }, [token]);

    const validateSession = async () => {
        try {
            const res = await fetch(`/api/bitsign/capture-session/${token}/upload`);
            if (res.status === 410) {
                setStatus('expired');
                return;
            }
            if (res.status === 409) {
                setStatus('error');
                setErrorMsg('This session has already been used.');
                return;
            }
            if (!res.ok) {
                setStatus('error');
                setErrorMsg('Invalid or expired session.');
                return;
            }
            const data = await res.json();
            setCaptureMode(data.captureMode);
            setStatus('ready');
        } catch {
            setStatus('error');
            setErrorMsg('Failed to connect. Please check your network.');
        }
    };

    const handleCapture = async (blob: Blob) => {
        setStatus('uploading');
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            const res = await fetch(`/api/bitsign/capture-session/${token}/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mediaData: base64,
                    mediaMimeType: blob.type,
                }),
            });

            if (res.status === 410) {
                setStatus('expired');
                return;
            }
            if (res.status === 409) {
                setStatus('error');
                setErrorMsg('This session has already been used.');
                return;
            }
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Upload failed');
            }

            setStatus('success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err?.message || 'Failed to upload. Please try again.');
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-10 h-10 border-t-2 border-white animate-spin rounded-full opacity-20 mx-auto" />
                    <p className="text-sm text-zinc-500">Connecting...</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-green-950 border border-green-800 rounded-full flex items-center justify-center mx-auto">
                        <FiCheck className="text-green-400" size={32} />
                    </div>
                    <h1 className="text-xl font-medium text-white">Sent to desktop!</h1>
                    <p className="text-sm text-zinc-500">You can close this tab now.</p>
                </div>
            </div>
        );
    }

    if (status === 'uploading') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center space-y-4">
                    <FiLoader className="text-white animate-spin mx-auto" size={32} />
                    <p className="text-sm text-zinc-400">Sending to desktop...</p>
                </div>
            </div>
        );
    }

    if (status === 'expired') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <FiAlertCircle className="text-amber-500 mx-auto" size={32} />
                    <h1 className="text-xl font-medium text-white">Session Expired</h1>
                    <p className="text-sm text-zinc-500">
                        Go back to your desktop and generate a new QR code.
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <FiAlertCircle className="text-red-500 mx-auto" size={32} />
                    <h1 className="text-xl font-medium text-white">Error</h1>
                    <p className="text-sm text-zinc-400">{errorMsg}</p>
                </div>
            </div>
        );
    }

    // status === 'ready'
    return (
        <MediaCapture
            mode={captureMode}
            facingMode="environment"
            onCapture={handleCapture}
            onCancel={() => {
                // Can't really cancel on phone — just show a message
                setStatus('error');
                setErrorMsg('Capture cancelled. Close this tab and try again from your desktop.');
            }}
        />
    );
}
