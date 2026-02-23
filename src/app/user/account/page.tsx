'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { encryptDocument, bufferToBase64, decryptDocument, base64ToBuffer } from '@/lib/attestation';
import SovereignSignature from '@/components/SovereignSignature';
import MediaCapture from '@/components/MediaCapture';
import {
    FiLock,
    FiFileText,
    FiEdit3,
    FiActivity,
    FiExternalLink,
    FiPlus,
    FiCpu,
    FiCamera,
    FiDownload,
    FiChevronDown,
    FiZap,
    FiGithub,
    FiSettings
} from 'react-icons/fi';

interface Signature {
    id: string;
    signature_type: string;
    txid: string;
    created_at: string;
    metadata: any;
}

interface Identity {
    token_id: string;
    metadata: any;
    avatar_url?: string;
    github_handle?: string;
    github_id?: string;
    github_metadata?: any;
}

export default function AccountPage() {
    const [handle, setHandle] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [captureMode, setCaptureMode] = useState<'PHOTO' | 'VIDEO' | null>(null);
    const [encryptionSeed, setEncryptionSeed] = useState<string | null>(null);
    const [activeCaptureTab, setActiveCaptureTab] = useState<'biological' | 'camera' | 'video' | 'vault'>('biological');
    const [isProcessing, setIsProcessing] = useState(false);
    const [marketRate, setMarketRate] = useState(0.05);

    const exportIdentity = async () => {
        setIsProcessing(true);
        try {
            const manifest = {
                handle: `$${handle}`,
                dna: identity?.token_id,
                attestations: signatures.map(s => ({
                    type: s.signature_type,
                    txid: s.txid,
                    timestamp: s.created_at,
                    label: s.metadata?.type
                })),
                timestamp: new Date().toISOString(),
                protocol: "BIT-SIGN v1.0.4-genesis"
            };

            const response = await fetch('/api/bitsign/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manifest })
            });

            const { signature, publicKey, manifest: signedManifest } = await response.json();

            const finalBundle = {
                manifest: JSON.parse(signedManifest),
                verification: {
                    signature,
                    publicKey,
                    method: 'HandCash Data Signing (Identity Token)'
                }
            };

            const blob = new Blob([JSON.stringify(finalBundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bit-sign-identity-${handle}.json`;
            a.click();
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        const cookies = document.cookie.split('; ');
        const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
        if (handleCookie) {
            const h = handleCookie.split('=')[1];
            setHandle(h);
            fetchData(h);
            fetchEncryptionSeed();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchEncryptionSeed = async () => {
        try {
            const res = await fetch('/api/bitsign/encryption-seed');
            const data = await res.json();
            if (data.encryptionSeed) setEncryptionSeed(data.encryptionSeed);
        } catch (error) {
            console.error('Failed to fetch encryption seed:', error);
        }
    };

    const fetchData = async (h: string) => {
        try {
            const res = await fetch(`/api/bitsign/signatures?handle=${h}`);
            const data = await res.json();
            if (data.signatures) setSignatures(data.signatures);
            if (data.identity) setIdentity(data.identity);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTldrawSave = async (signatureData: { svg: string; json: string }) => {
        if (!handle || !encryptionSeed) return;
        setIsProcessing(true);
        try {
            const encoder = new TextEncoder();
            const svgBuffer = encoder.encode(signatureData.svg).buffer;
            const encrypted = await encryptDocument(svgBuffer, encryptionSeed);

            const response = await fetch('/api/bitsign/inscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    encryptedData: bufferToBase64(encrypted.encryptedData),
                    iv: bufferToBase64(encrypted.iv.buffer),
                    handle,
                    signatureType: 'TLDRAW',
                    metadata: { type: 'Hand-written Signature' }
                })
            });
            const { txid } = await response.json();

            setSignatures(prev => [{
                id: Math.random().toString(),
                signature_type: 'TLDRAW',
                txid,
                created_at: new Date().toISOString(),
                metadata: { type: 'Hand-written Signature' }
            }, ...prev]);

            setIsSignatureModalOpen(false);
        } catch (error) {
            console.error('Signature failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMediaCapture = async (blob: Blob) => {
        if (!handle || !encryptionSeed) return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const encrypted = await encryptDocument(arrayBuffer, encryptionSeed);

            const type = captureMode === 'PHOTO' ? 'CAMERA' : 'VIDEO';
            const label = captureMode === 'PHOTO' ? 'Camera Proof' : 'Video Witness';

            const response = await fetch('/api/bitsign/inscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    encryptedData: bufferToBase64(encrypted.encryptedData),
                    iv: bufferToBase64(encrypted.iv.buffer),
                    handle,
                    signatureType: type,
                    metadata: { type: label, mimeType: blob.type }
                })
            });
            const { txid } = await response.json();

            setSignatures(prev => [{
                id: Math.random().toString(),
                signature_type: type,
                txid,
                created_at: new Date().toISOString(),
                metadata: { type: label, mimeType: blob.type }
            }, ...prev]);

            setCaptureMode(null);
        } catch (error) {
            console.error('Media capture failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !handle || !encryptionSeed) return;

        setIsProcessing(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const arrayBuffer = await file.arrayBuffer();
                const encrypted = await encryptDocument(arrayBuffer, encryptionSeed);

                const response = await fetch('/api/bitsign/inscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        encryptedData: bufferToBase64(encrypted.encryptedData),
                        iv: bufferToBase64(encrypted.iv.buffer),
                        handle,
                        signatureType: 'DOCUMENT',
                        metadata: { type: 'Encrypted Document', fileName: file.name }
                    })
                });
                const { txid } = await response.json();

                setSignatures(prev => [{
                    id: Math.random().toString(),
                    signature_type: 'DOCUMENT',
                    txid,
                    created_at: new Date().toISOString(),
                    metadata: { type: 'Encrypted Document', fileName: file.name }
                }, ...prev]);
            }
        } catch (error) {
            console.error('Document upload failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const mintIdentity = async () => {
        if (!handle) return;
        setIsProcessing(true);
        try {
            const response = await fetch('/api/bitsign/inscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handle,
                    signatureType: 'IDENTITY_MINT',
                    metadata: { type: 'Digital DNA', symbol: `$${handle.toUpperCase()}-DNA` }
                })
            });
            const data = await response.json();
            setIdentity(data.identity);
        } catch (error) {
            console.error('Identity mint failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadSignature = async (sigId: string, fileName?: string, mimeType?: string) => {
        if (!encryptionSeed) return;
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();

            const encryptedBuffer = new Uint8Array(base64ToBuffer(data.encrypted_payload) as ArrayBuffer);
            const ivBuffer = new Uint8Array(base64ToBuffer(data.iv) as ArrayBuffer);
            const decrypted = await decryptDocument(encryptedBuffer, ivBuffer, encryptionSeed);

            const type = mimeType || 'application/octet-stream';
            const blob = new Blob([decrypted], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || `bit-sign-${sigId.slice(0, 8)}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to decrypt and download. Please try again.');
        }
    };

    const sendTestVerification = async () => {
        if (!handle) return;
        setIsProcessing(true);
        try {
            const response = await fetch('/api/bitsign/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handle,
                    message: "TEST VERIFICATION: Verify your Digital DNA connection.",
                    fee: 0.01
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            window.open(data.paymentUrl, '_blank');
        } catch (error) {
            console.error('Test verification failed:', error);
            alert('Failed to send test verification request');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-white animate-spin rounded-full opacity-20"></div>
            </div>
        );
    }

    if (!handle) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-4xl font-bold mb-4 tracking-tight">Please sign in</h1>
                <p className="text-zinc-400 mb-8 max-w-md text-base leading-relaxed">
                    Connect your HandCash wallet to access your account.
                </p>
                <Link
                    href="/api/auth/handcash"
                    className="px-8 py-3 bg-white text-black font-medium rounded-md transition-all hover:bg-zinc-200 text-sm"
                >
                    Sign in with HandCash
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-zinc-800 selection:text-white overflow-x-hidden">
            <div className="relative z-10 p-6 pt-24 max-w-7xl mx-auto space-y-12 pb-40">
                {/* Header: Identity Bar */}
                <header className="grid lg:grid-cols-12 gap-8 border-b border-zinc-900 pb-12 items-end">
                    <div className="lg:col-span-8 flex flex-col md:flex-row md:items-center gap-8">
                        <div className="w-20 h-20 bg-black border border-zinc-800 flex items-center justify-center text-4xl shadow-lg rounded-lg shrink-0 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-zinc-900/0 group-hover:bg-zinc-900/20 transition-colors" />
                            {identity?.avatar_url ? (
                                <img src={identity.avatar_url} alt={handle || ''} className="w-full h-full object-cover grayscale contrast-125" />
                            ) : (
                                <span className="grayscale opacity-50">&#128100;</span>
                            )}
                            <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                        </div>

                        <div className="space-y-3">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                                    ${handle}
                                </h1>
                                <p className="text-zinc-500 text-sm mt-1 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                                    Identity token active
                                </p>
                            </div>

                            {identity && (
                                <div className="flex items-center gap-4">
                                    {identity.github_handle ? (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-sm text-zinc-400 rounded-md">
                                            <FiGithub className="text-white" />
                                            Linked: <span className="text-white font-medium">{identity.github_handle}</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => window.location.href = '/api/auth/github'}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-500 text-sm text-zinc-500 hover:text-white transition-all rounded-md group"
                                        >
                                            <FiGithub />
                                            <span className="group-hover:translate-x-0.5 transition-transform">Link GitHub</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between h-full gap-6">
                        {identity && (
                            <div className="flex gap-2">
                                <button
                                    onClick={sendTestVerification}
                                    disabled={isProcessing}
                                    className="px-4 py-2 border border-zinc-800 bg-zinc-950 text-zinc-400 text-sm font-medium rounded-md hover:bg-zinc-900 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <FiZap /> Test Alert
                                </button>
                                <button
                                    onClick={exportIdentity}
                                    className="px-4 py-2 border border-zinc-800 bg-zinc-950 text-zinc-400 text-sm font-medium rounded-md hover:border-white/20 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <FiDownload /> Export Identity
                                </button>
                            </div>
                        )}

                        {!identity ? (
                            <button
                                onClick={mintIdentity}
                                disabled={isProcessing}
                                className="w-full lg:w-auto px-6 py-3 bg-white text-black hover:bg-zinc-200 font-medium text-sm rounded-md transition-all flex items-center justify-center gap-3"
                            >
                                <FiCpu className="text-lg" />
                                <span>Mint Identity Token</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-4 px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-md">
                                <div className="text-right">
                                    <span className="block text-xs text-zinc-500">Identity Token</span>
                                    <span className="block font-mono text-sm text-white font-medium">{identity.metadata?.symbol || 'UNREGISTERED'}</span>
                                </div>
                                <a
                                    href={`https://whatsonchain.com/tx/${identity.token_id}`}
                                    target="_blank"
                                    className="p-2 bg-zinc-900 text-zinc-500 hover:text-white transition-colors rounded-md"
                                >
                                    <FiExternalLink />
                                </a>
                            </div>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
                    {/* Left Col: Verification Methods (4/12) */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Tab Selector */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-zinc-400">
                                Verification Methods
                            </h3>

                            <div className="grid grid-cols-2 gap-1">
                                {[
                                    { id: 'biological', label: 'Signature', sub: 'Hand-drawn', icon: FiEdit3 },
                                    { id: 'camera', label: 'Photo', sub: 'Camera', icon: FiCamera },
                                    { id: 'video', label: 'Video', sub: 'Recording', icon: FiActivity },
                                    { id: 'vault', label: 'Document', sub: 'Upload', icon: FiLock }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveCaptureTab(tab.id as any)}
                                        className={`group relative p-5 border rounded-md flex flex-col items-center justify-center gap-2 transition-all ${activeCaptureTab === tab.id
                                            ? 'bg-zinc-900 border-zinc-700 text-white'
                                            : 'bg-black border-zinc-900 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                                            }`}
                                    >
                                        <tab.icon className="text-xl" />
                                        <div className="text-center">
                                            <span className="block text-sm font-medium">{tab.label}</span>
                                            <span className="block text-xs text-zinc-500">{tab.sub}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Input Panel */}
                        <div className="border border-zinc-800 bg-zinc-950 rounded-md overflow-hidden">
                            <div className="bg-black p-6 border border-zinc-900 space-y-6 min-h-[280px] flex flex-col justify-between rounded-md">
                                <div className="space-y-3">
                                    <h4 className="text-lg font-semibold text-white">
                                        {activeCaptureTab === 'biological' && 'Hand-drawn Signature'}
                                        {activeCaptureTab === 'camera' && 'Photo Verification'}
                                        {activeCaptureTab === 'video' && 'Video Recording'}
                                        {activeCaptureTab === 'vault' && 'Upload Documents'}
                                    </h4>
                                    <p className="text-sm text-zinc-500 leading-relaxed">
                                        {activeCaptureTab === 'biological' && 'Draw your signature using the touchscreen or mouse. It will be encrypted and recorded on-chain.'}
                                        {activeCaptureTab === 'camera' && 'Take a photo for identity verification. The image is encrypted before upload.'}
                                        {activeCaptureTab === 'video' && 'Record a short video statement as proof of identity and intent.'}
                                        {activeCaptureTab === 'vault' && 'Upload one or more documents to encrypt and anchor on the blockchain.'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {activeCaptureTab === 'biological' && (
                                        <button onClick={() => setIsSignatureModalOpen(true)} className="w-full py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                                            <FiEdit3 /> Draw Signature
                                        </button>
                                    )}
                                    {activeCaptureTab === 'camera' && (
                                        <button onClick={() => setCaptureMode('PHOTO')} className="w-full py-3 bg-zinc-900 border border-zinc-800 text-white font-medium text-sm rounded-md hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-center gap-2">
                                            <FiCamera /> Take Photo
                                        </button>
                                    )}
                                    {activeCaptureTab === 'video' && (
                                        <button onClick={() => setCaptureMode('VIDEO')} className="w-full py-3 bg-zinc-900 border border-zinc-800 text-white font-medium text-sm rounded-md hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-center gap-2">
                                            <FiActivity /> Record Video
                                        </button>
                                    )}
                                    {activeCaptureTab === 'vault' && (
                                        <label className="relative group block cursor-pointer">
                                            <input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleDocumentUpload} />
                                            <div className="w-full py-3 bg-zinc-900 border border-zinc-800 text-white font-medium text-sm rounded-md group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all flex items-center justify-center gap-2">
                                                <FiFileText /> Upload Files
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 rounded-md overflow-hidden">
                            <div className="bg-black p-5">
                                <span className="block text-xs text-zinc-500 mb-1">Total Signatures</span>
                                <span className="block text-2xl font-semibold text-white">{signatures.length}</span>
                            </div>
                            <div className="bg-black p-5 relative group overflow-hidden">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <FiSettings className="text-zinc-700" />
                                </div>
                                <span className="block text-xs text-zinc-500 mb-1">Data Access Rate</span>
                                <div className="flex items-baseline gap-1.5 mb-2">
                                    <span className="text-2xl font-semibold text-white">${marketRate.toFixed(2)}</span>
                                    <span className="text-xs text-zinc-500">/ query</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.01"
                                    max="1.00"
                                    step="0.01"
                                    value={marketRate}
                                    onChange={(e) => setMarketRate(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-white hover:accent-zinc-300 transition-all opacity-40 group-hover:opacity-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Signature History (8/12) */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Signature History
                            </h3>
                            <button className="text-sm text-zinc-600 hover:text-white transition-colors flex items-center gap-1.5">
                                View Full History <FiExternalLink size={12} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {signatures.length === 0 ? (
                                <div className="py-24 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-md text-center">
                                    <FiEdit3 className="text-zinc-700 text-3xl mb-4" />
                                    <p className="text-base text-zinc-400 font-medium">No signatures yet</p>
                                    <p className="text-sm text-zinc-600 mt-1">Create your first signature to get started.</p>
                                </div>
                            ) : (
                                signatures.map((sig, i) => (
                                    <div key={sig.id} className="group relative border border-zinc-900 bg-black hover:bg-zinc-950 transition-colors p-5 grid md:grid-cols-12 gap-4 items-center rounded-md">
                                        {/* Status Marker */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:bg-white transition-colors rounded-l-md" />

                                        {/* Col 1: Icon/Type */}
                                        <div className="md:col-span-1 text-zinc-600 group-hover:text-white transition-colors pl-2">
                                            {sig.signature_type === 'TLDRAW' && <FiEdit3 size={18} />}
                                            {sig.signature_type === 'CAMERA' && <FiCamera size={18} />}
                                            {sig.signature_type === 'VIDEO' && <FiActivity size={18} />}
                                            {sig.signature_type === 'DOCUMENT' && <FiFileText size={18} />}
                                            {sig.signature_type === 'IDENTITY_MINT' && <FiCpu size={18} />}
                                        </div>

                                        {/* Col 2: Info */}
                                        <div className="md:col-span-6 space-y-0.5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-white">
                                                    {sig.metadata?.fileName || sig.metadata?.type || sig.signature_type}
                                                </span>
                                                <span className="px-2 py-0.5 bg-zinc-900 text-[10px] text-zinc-400 rounded">Confirmed</span>
                                            </div>
                                            <div className="font-mono text-xs text-zinc-600 truncate">
                                                {sig.id.slice(0, 12)}...
                                            </div>
                                        </div>

                                        {/* Col 3: Timestamp */}
                                        <div className="md:col-span-3 text-right">
                                            <span className="block text-sm text-zinc-400">
                                                {new Date(sig.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="block text-xs text-zinc-600">
                                                {new Date(sig.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        {/* Col 4: Actions */}
                                        <div className="md:col-span-2 flex justify-end gap-1.5">
                                            {(sig.signature_type === 'DOCUMENT' || sig.signature_type === 'TLDRAW' || sig.signature_type === 'CAMERA' || sig.signature_type === 'VIDEO') && (
                                                <button
                                                    onClick={() => downloadSignature(sig.id, sig.metadata?.fileName, sig.metadata?.mimeType)}
                                                    className="w-9 h-9 border border-zinc-800 rounded-md flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all bg-black"
                                                    title="Download"
                                                >
                                                    <FiDownload size={14} />
                                                </button>
                                            )}
                                            {sig.txid && !sig.txid.startsWith('pending-') ? (
                                                <a
                                                    href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                    target="_blank"
                                                    className="w-9 h-9 border border-zinc-800 rounded-md flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all bg-black"
                                                    title="Verify on blockchain"
                                                >
                                                    <FiExternalLink size={14} />
                                                </a>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-amber-950/30 text-amber-500 text-[10px] rounded">Pending</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Session Footer */}
                <footer className="pt-16 border-t border-zinc-900 flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
                    <span className="text-sm text-zinc-600">
                        {handle}
                    </span>
                    <Link
                        href="/api/auth/logout"
                        className="text-sm text-red-900 hover:text-red-500 transition-colors"
                    >
                        Sign Out
                    </Link>
                </footer>

                {/* Modals & Overlays */}
                {isSignatureModalOpen && (
                    <SovereignSignature
                        onSave={handleTldrawSave}
                        onCancel={() => setIsSignatureModalOpen(false)}
                    />
                )}

                {captureMode && (
                    <MediaCapture
                        mode={captureMode}
                        onCapture={handleMediaCapture}
                        onCancel={() => setCaptureMode(null)}
                    />
                )}

                {isProcessing && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center">
                        <div className="flex flex-col items-center gap-8">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-t-2 border-r-2 border-white animate-spin rounded-full opacity-20" />
                                <div className="absolute inset-4 border-b-2 border-l-2 border-zinc-500 animate-[spin_4s_linear_infinite] rounded-full opacity-40" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FiCpu className="text-white text-lg animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <span className="block text-base text-white font-medium">Processing...</span>
                                <span className="block text-sm text-zinc-500">Encrypting and uploading</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
