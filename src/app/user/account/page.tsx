'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { encryptDocument, bufferToBase64 } from '@/lib/attestation';
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
        const file = e.target.files?.[0];
        if (!file || !handle || !encryptionSeed) return;

        setIsProcessing(true);
        try {
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

            // Open the payment URL in a new tab to simulate the push notification flow
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
                <div className="w-12 h-12 border-t-2 border-white animate-spin opacity-20"></div>
            </div>
        );
    }

    if (!handle) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-6xl font-mono font-black mb-6 tracking-tighter uppercase italic">SESSION REVOKED</h1>
                <p className="text-zinc-500 font-mono mb-10 max-w-md uppercase text-[10px] tracking-[0.4em] leading-relaxed">
                    This personal node requires a valid HandCash protocol handshake.
                </p>
                <Link
                    href="/api/auth/handcash"
                    className="px-12 py-4 bg-white text-black font-mono font-bold uppercase transition-all hover:bg-zinc-200 text-xs tracking-widest"
                >
                    Authorize Node
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-zinc-800 selection:text-white overflow-x-hidden">
            {/* Background Grid Pattern */}
            <div className="fixed inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

            <div className="relative z-10 p-6 pt-24 max-w-7xl mx-auto space-y-12 pb-40">
                {/* Header: Identity Bar */}
                <header className="grid lg:grid-cols-12 gap-8 border-b border-zinc-900 pb-12 items-end">
                    <div className="lg:col-span-8 flex flex-col md:flex-row md:items-center gap-8">
                        <div className="w-24 h-24 bg-black border border-zinc-800 flex items-center justify-center text-4xl shadow-xl rounded-sm shrink-0 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-zinc-900/0 group-hover:bg-zinc-900/20 transition-colors" />
                            {identity?.avatar_url ? (
                                <img src={identity.avatar_url} alt={handle || ''} className="w-full h-full object-cover grayscale contrast-125" />
                            ) : (
                                <span className="grayscale opacity-50">👤</span>
                            )}
                            <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h1 className="text-5xl md:text-7xl font-mono font-black tracking-tighter uppercase italic leading-none text-white flex items-center gap-4">
                                    ${handle}
                                    <span className="text-xl md:text-2xl text-zinc-700 not-italic tracking-widest font-normal">/// NODE</span>
                                </h1>
                                <p className="text-zinc-600 font-mono text-[10px] tracking-[0.4em] uppercase mt-2 pl-1 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-zinc-800 rounded-full" />
                                    Identity Token Active
                                </p>
                            </div>

                            {identity && (
                                <div className="flex items-center gap-4">
                                    {identity.github_handle ? (
                                        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                            <FiGithub className="text-white" />
                                            Linked: <span className="text-white">{identity.github_handle}</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => window.location.href = '/api/auth/github'}
                                            className="flex items-center gap-3 px-4 py-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-500 text-[10px] font-mono text-zinc-500 hover:text-white transition-all uppercase tracking-widest group"
                                        >
                                            <FiGithub />
                                            <span className="group-hover:translate-x-1 transition-transform">Link GitHub</span>
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
                                    className="px-6 py-3 border border-zinc-800 bg-zinc-950 text-zinc-400 font-mono font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-900 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <FiZap /> Test Alert
                                </button>
                                <button
                                    onClick={exportIdentity}
                                    className="px-6 py-3 border border-zinc-800 bg-zinc-950 text-zinc-400 font-mono font-bold uppercase text-[10px] tracking-widest hover:border-white/20 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <FiDownload /> Digital DNA
                                </button>
                            </div>
                        )}

                        {!identity ? (
                            <button
                                onClick={mintIdentity}
                                disabled={isProcessing}
                                className="w-full lg:w-auto px-8 py-4 bg-white text-black hover:bg-zinc-200 font-mono font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                            >
                                <FiCpu className="text-lg" />
                                <span>Mint Identity Token</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-4 px-6 py-3 bg-zinc-950 border border-zinc-900">
                                <div className="text-right">
                                    <span className="block text-[9px] text-zinc-600 font-mono uppercase tracking-widest">DNA Sequence</span>
                                    <span className="block font-mono text-xs text-white font-black tracking-tight uppercase">{identity.metadata?.symbol || 'UNREGISTERED'}</span>
                                </div>
                                <a
                                    href={`https://whatsonchain.com/tx/${identity.token_id}`}
                                    target="_blank"
                                    className="p-2 bg-zinc-900 text-zinc-500 hover:text-white transition-colors"
                                >
                                    <FiExternalLink />
                                </a>
                            </div>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
                    {/* Left Col: Attestation Station (4/12) */}
                    <div className="lg:col-span-4 space-y-12">

                        {/* Tool Selector Grid */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-2">
                                <span className="w-1 h-1 bg-white"></span> Attestation Protocol
                            </h3>

                            <div className="grid grid-cols-2 gap-1">
                                {[
                                    { id: 'biological', label: 'BIO', sub: 'Sign', icon: FiEdit3 },
                                    { id: 'camera', label: 'CAM', sub: 'Photo', icon: FiCamera },
                                    { id: 'video', label: 'REC', sub: 'Video', icon: FiActivity },
                                    { id: 'vault', label: 'DOC', sub: 'Upload', icon: FiLock }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveCaptureTab(tab.id as any)}
                                        className={`group relative p-6 border flex flex-col items-center justify-center gap-3 transition-all ${activeCaptureTab === tab.id
                                            ? 'bg-zinc-900 border-white/20 text-white z-10'
                                            : 'bg-black border-zinc-900 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                                            }`}
                                    >
                                        <tab.icon className="text-xl" />
                                        <div className="text-center">
                                            <span className="block text-xs font-black uppercase tracking-widest">{tab.label}</span>
                                            <span className="block text-[9px] uppercase tracking-wider opacity-60">{tab.sub}</span>
                                        </div>
                                        {activeCaptureTab === tab.id && (
                                            <div className="absolute inset-0 border-2 border-white/5 pointer-events-none animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Input Interface */}
                        <div className="border border-zinc-800 bg-zinc-950 p-1 relative">
                            {/* Corner Accents */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-white/20" />
                            <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-white/20" />
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-white/20" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-white/20" />

                            <div className="bg-black p-8 border border-zinc-900 space-y-8 min-h-[300px] flex flex-col justify-between">
                                <div className="space-y-4">
                                    <h4 className="text-xl font-mono font-black uppercase tracking-tighter italic text-white">
                                        {activeCaptureTab === 'biological' && 'Biological Proof'}
                                        {activeCaptureTab === 'camera' && 'Visual Evidence'}
                                        {activeCaptureTab === 'video' && 'Witness Statement'}
                                        {activeCaptureTab === 'vault' && 'Secure Data Vault'}
                                    </h4>
                                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.1em] leading-relaxed border-l border-zinc-800 pl-4">
                                        {activeCaptureTab === 'biological' && 'Execute biometric signature verification using touchscreen input.'}
                                        {activeCaptureTab === 'camera' && 'Capture high-resolution optical data for asset verification.'}
                                        {activeCaptureTab === 'video' && 'Record temporal proof of life and intent statement.'}
                                        {activeCaptureTab === 'vault' && 'Encrypt and immutably anchor sensitive documentation.'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {activeCaptureTab === 'biological' && (
                                        <button onClick={() => setIsSignatureModalOpen(true)} className="w-full py-4 bg-white text-black font-black uppercase text-sm tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3">
                                            <FiEdit3 /> Initialize Canvas
                                        </button>
                                    )}
                                    {activeCaptureTab === 'camera' && (
                                        <button onClick={() => setCaptureMode('PHOTO')} className="w-full py-4 bg-zinc-900 border border-zinc-800 text-white font-black uppercase text-sm tracking-widest hover:bg-zinc-800 hover:border-white/20 transition-all flex items-center justify-center gap-3">
                                            <FiCamera /> Activate Sensor
                                        </button>
                                    )}
                                    {activeCaptureTab === 'video' && (
                                        <button onClick={() => setCaptureMode('VIDEO')} className="w-full py-4 bg-zinc-900 border border-zinc-800 text-red-500 font-black uppercase text-sm tracking-widest hover:bg-zinc-800 hover:border-red-500/30 transition-all flex items-center justify-center gap-3">
                                            <FiActivity /> Live Feed
                                        </button>
                                    )}
                                    {activeCaptureTab === 'vault' && (
                                        <div className="relative group">
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleDocumentUpload} />
                                            <button className="w-full py-4 bg-zinc-900 border border-zinc-800 text-blue-400 font-black uppercase text-sm tracking-widest group-hover:bg-zinc-800 group-hover:border-blue-500/30 transition-all flex items-center justify-center gap-3">
                                                <FiLock /> Encrypt & Upload
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Metrics Compact */}
                        <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
                            <div className="bg-black p-6">
                                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Total Attestations</span>
                                <span className="block text-3xl font-black text-white italic">{signatures.length.toString().padStart(2, '0')}</span>
                            </div>
                            <div className="bg-black p-6 relative group overflow-hidden">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <FiSettings className="text-zinc-800" />
                                </div>
                                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Data Access Rate</span>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-3xl font-black text-white italic">${marketRate.toFixed(2)}</span>
                                    <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">/ Query</span>
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

                    {/* Right Col: Signature Chain (8/12) */}
                    <div className="lg:col-span-8 space-y-12">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                            <h3 className="text-xs font-mono font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                <span className="w-1 h-1 bg-green-500"></span> Identity Chain
                            </h3>
                            <button className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 hover:text-white transition-colors flex items-center gap-2">
                                View Full History <FiExternalLink />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {signatures.length === 0 ? (
                                <div className="py-32 flex flex-col items-center justify-center border border-dashed border-zinc-900 text-center">
                                    <FiLock className="text-zinc-800 text-4xl mb-6" />
                                    <p className="font-mono text-sm text-zinc-500 uppercase tracking-[0.2em] font-bold">Initialize Identity Chain</p>
                                    <p className="font-mono text-xs text-zinc-700 uppercase tracking-widest mt-2">Sign your Genesis Block to begin.</p>
                                </div>
                            ) : (
                                signatures.map((sig, i) => (
                                    <div key={sig.id} className="group relative border border-zinc-900 bg-black hover:bg-zinc-950 transition-colors p-6 grid md:grid-cols-12 gap-6 items-center">
                                        {/* Status Marker */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:bg-white transition-colors" />

                                        {/* Col 1: Icon/Type */}
                                        <div className="md:col-span-1 text-zinc-600 group-hover:text-white transition-colors">
                                            {sig.signature_type === 'TLDRAW' && <FiEdit3 size={20} />}
                                            {sig.signature_type === 'CAMERA' && <FiCamera size={20} />}
                                            {sig.signature_type === 'VIDEO' && <FiActivity size={20} />}
                                            {sig.signature_type === 'DOCUMENT' && <FiLock size={20} />}
                                            {sig.signature_type === 'IDENTITY_MINT' && <FiCpu size={20} />}
                                        </div>

                                        {/* Col 2: Info */}
                                        <div className="md:col-span-6 space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-black text-sm uppercase tracking-wider text-white">
                                                    {sig.metadata?.type || sig.signature_type}
                                                </span>
                                                <span className="px-2 py-px bg-zinc-900 text-[8px] text-zinc-400 uppercase tracking-widest rounded-sm">Confirmed</span>
                                            </div>
                                            <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest truncate">
                                                UID: {sig.id.slice(0, 12)}...
                                            </div>
                                        </div>

                                        {/* Col 3: Timestamp */}
                                        <div className="md:col-span-3 text-right">
                                            <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                                                {new Date(sig.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="block font-mono text-[10px] text-zinc-700 uppercase tracking-widest">
                                                {new Date(sig.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        {/* Col 4: Action */}
                                        <div className="md:col-span-2 flex justify-end">
                                            <a
                                                href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                target="_blank"
                                                className="w-10 h-10 border border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all bg-black"
                                                title="Verify on Blockchain"
                                            >
                                                <FiExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Session Footer */}
                <footer className="pt-24 border-t border-zinc-900 flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-[0.3em] font-mono">
                        Node ID: {handle}
                    </div>
                    <Link
                        href="/api/auth/logout"
                        className="text-[9px] text-red-900 hover:text-red-500 uppercase tracking-[0.3em] font-mono transition-colors"
                    >
                        Terminate Session
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
                        <div className="flex flex-col items-center gap-12">
                            {/* Industrial Spinner */}
                            <div className="relative w-24 h-24">
                                <div className="absolute inset-0 border-t-2 border-r-2 border-white animate-spin rounded-full opacity-20" />
                                <div className="absolute inset-4 border-b-2 border-l-2 border-zinc-500 animate-[spin_4s_linear_infinite] rounded-full opacity-40" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FiCpu className="text-white text-2xl animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <span className="block font-mono text-sm text-white font-black uppercase tracking-[0.5em] italic">Inscribing</span>
                                <span className="block font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Writing to immutable ledger...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                ::selection {
                    background-color: #27272a;
                    color: white;
                }
            `}</style>
        </div>
    );
}
