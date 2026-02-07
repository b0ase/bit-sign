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
    FiGithub
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
                    method: 'HandCash Data Signing (Sovereign)'
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
                    This sovereign node requires a valid HandCash protocol handshake.
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
        <div className="min-h-screen text-white selection:bg-white selection:text-black">

            <div className="relative z-10 p-6 pt-24 max-w-7xl mx-auto space-y-16 pb-40">
                {/* Header: Identity Bar */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 border-b border-white/[0.05] pb-16">
                    <div className="space-y-6">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-zinc-900/50 border border-white/[0.08] flex items-center justify-center text-4xl shadow-2xl rounded-sm backdrop-blur-sm">
                                👤
                            </div>
                            <div>
                                <h1 className="text-6xl md:text-8xl font-mono font-black tracking-tighter uppercase italic leading-none">${handle}</h1>
                                <p className="text-zinc-400 font-mono text-xs tracking-[0.3em] uppercase mt-2">Sovereign Identity Node // Authenticated</p>

                                {identity && (
                                    <div className="mt-6 flex items-center gap-4">
                                        {identity.github_handle ? (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-300 uppercase tracking-widest">
                                                <FiGithub className="text-white text-sm" />
                                                Linked: <span className="text-white">{identity.github_handle}</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => window.location.href = '/api/auth/github'}
                                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-400 hover:text-white hover:border-white/20 transition-all uppercase tracking-widest"
                                            >
                                                <FiGithub className="text-sm" />
                                                Link GitHub Profile
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        {identity && (
                            <div className="flex gap-4">
                                <button
                                    onClick={sendTestVerification}
                                    disabled={isProcessing}
                                    className="px-8 py-4 border border-zinc-700 bg-zinc-900/50 text-zinc-300 font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2 group"
                                    title="Send Verification Request to Phone"
                                >
                                    <FiZap className={isProcessing ? "animate-pulse text-lg" : "group-hover:scale-110 transition-transform text-lg"} />
                                    {isProcessing ? "Sending..." : "Test Notify"}
                                </button>

                                <button
                                    onClick={exportIdentity}
                                    className="px-8 py-4 border border-blue-500/20 bg-blue-500/5 text-blue-400 font-mono font-black uppercase text-xs tracking-widest hover:bg-blue-500/10 transition-all flex items-center gap-2 group"
                                    title="Export Verified Identity Bundle"
                                >
                                    <FiDownload className="group-hover:translate-y-1 transition-transform text-lg" /> Export Bundle
                                </button>
                            </div>
                        )}
                        {!identity ? (
                            <button
                                onClick={mintIdentity}
                                disabled={isProcessing}
                                className="group relative px-10 py-5 bg-white text-black font-mono font-bold uppercase text-sm hover:bg-neutral-200 transition-all flex items-center gap-3 overflow-hidden"
                            >
                                <FiCpu className="text-xl" />
                                <span className="relative z-10 font-black">{isProcessing ? "Initialising..." : "Mint Digital DNA"}</span>
                                {isProcessing && <div className="absolute inset-0 bg-zinc-200 animate-pulse" />}
                            </button>
                        ) : (
                            <div className="px-8 py-4 border border-white/[0.05] bg-zinc-900/30 backdrop-blur-md flex items-center gap-6 group hover:border-white/20 transition-all">
                                <div>
                                    <span className="block text-[11px] text-zinc-400 font-mono uppercase tracking-[0.2em] mb-1">On-Chain DNA Status</span>
                                    <span className="font-mono text-sm text-white font-black tracking-tighter italic uppercase">{identity.metadata.symbol}</span>
                                </div>
                                <div className="w-px h-10 bg-white/10" />
                                <a
                                    href={`https://whatsonchain.com/tx/${identity.token_id}`}
                                    target="_blank"
                                    className="text-zinc-500 hover:text-white transition-colors p-2 bg-white/5 rounded-full"
                                    title="View Genesis Ledger"
                                >
                                    <FiExternalLink className="text-lg" />
                                </a>
                            </div>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    {/* Left Col: Actions (4/12) */}
                    <div className="lg:col-span-4 space-y-12">
                        <div className="space-y-8">
                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-6">
                                <h3 className="text-sm font-mono font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
                                    <FiPlus className="text-blue-500 text-lg" /> Multi-factor Attestation
                                </h3>
                            </div>

                            {/* Mobile Dropdown */}
                            <div className="lg:hidden relative">
                                <select
                                    value={activeCaptureTab}
                                    onChange={(e) => setActiveCaptureTab(e.target.value as any)}
                                    className="w-full bg-zinc-900/50 border border-white/10 p-4 font-mono text-sm font-black uppercase tracking-widest text-white appearance-none outline-none focus:border-blue-500/50 transition-colors"
                                >
                                    <option value="biological">Biological Proof</option>
                                    <option value="camera">Camera Proof</option>
                                    <option value="video">Video Witness</option>
                                    <option value="vault">Sovereign Vault</option>
                                </select>
                                <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                            </div>

                            {/* Desktop Tabs */}
                            <div className="hidden lg:grid grid-cols-1 gap-2">
                                {[
                                    { id: 'biological', label: 'Biological', icon: FiEdit3, desc: 'Hand-drawn signature' },
                                    { id: 'camera', label: 'Camera', icon: FiCamera, desc: 'Photo evidence' },
                                    { id: 'video', label: 'Video', icon: FiActivity, desc: 'Recorded statement' },
                                    { id: 'vault', label: 'Vault', icon: FiLock, desc: 'Encrypted docs' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveCaptureTab(tab.id as any)}
                                        className={`group flex items-center gap-6 p-6 border transition-all text-left ${activeCaptureTab === tab.id
                                            ? 'bg-zinc-900 border-white/10'
                                            : 'bg-transparent border-transparent hover:bg-zinc-900/40 hover:border-white/5'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 border flex items-center justify-center transition-all ${activeCaptureTab === tab.id
                                            ? 'border-blue-500/50 text-blue-500 bg-blue-500/5'
                                            : 'border-white/5 text-zinc-700'
                                            }`}>
                                            <tab.icon size={24} />
                                        </div>
                                        <div>
                                            <span className={`block font-mono font-black text-sm uppercase tracking-tighter ${activeCaptureTab === tab.id ? 'text-white' : 'text-zinc-500'
                                                }`}>
                                                {tab.label}
                                            </span>
                                            <p className="text-[11px] text-zinc-500 font-mono uppercase mt-1 tracking-tight h-0 overflow-hidden group-hover:h-auto transition-all">
                                                {tab.desc}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Active Content Card */}
                            <div className="p-10 border border-white/[0.05] bg-zinc-900/20 backdrop-blur-sm space-y-8">
                                {activeCaptureTab === 'biological' && (
                                    <div className="space-y-6">
                                        <div>
                                            <span className="block text-xs font-mono font-black text-white uppercase tracking-widest mb-2">Biological Proof</span>
                                            <p className="text-xs text-zinc-500 font-mono uppercase leading-relaxed">
                                                Inscribe your hand-drawn signature as a permanent biological witness to your digital transactions.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsSignatureModalOpen(true)}
                                            className="w-full py-5 bg-white text-black font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-3"
                                        >
                                            <FiEdit3 className="text-lg" /> Open Canvas
                                        </button>
                                    </div>
                                )}

                                {activeCaptureTab === 'camera' && (
                                    <div className="space-y-6">
                                        <div>
                                            <span className="block text-xs font-mono font-black text-white uppercase tracking-widest mb-2">Camera Evidence</span>
                                            <p className="text-xs text-zinc-500 font-mono uppercase leading-relaxed">
                                                Secure visual verification of physical identity documents or signed paper assets.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setCaptureMode('PHOTO')}
                                            className="w-full py-5 bg-orange-600/10 border border-orange-600/30 text-orange-500 font-mono font-black uppercase text-xs tracking-widest hover:bg-orange-600/20 transition-all flex items-center justify-center gap-3"
                                        >
                                            <FiCamera className="text-lg" /> Launch Camera
                                        </button>
                                    </div>
                                )}

                                {activeCaptureTab === 'video' && (
                                    <div className="space-y-6">
                                        <div>
                                            <span className="block text-xs font-mono font-black text-white uppercase tracking-widest mb-2">Video Witness</span>
                                            <p className="text-xs text-zinc-500 font-mono uppercase leading-relaxed">
                                                Record a high-signal video statement to prove biological presence and intent on-chain.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setCaptureMode('VIDEO')}
                                            className="w-full py-5 bg-red-600/10 border border-red-600/30 text-red-500 font-mono font-black uppercase text-xs tracking-widest hover:bg-red-600/20 transition-all flex items-center justify-center gap-3"
                                        >
                                            <FiActivity className="text-lg" /> Launch Video
                                        </button>
                                    </div>
                                )}

                                {activeCaptureTab === 'vault' && (
                                    <div className="space-y-6">
                                        <div>
                                            <span className="block text-xs font-mono font-black text-white uppercase tracking-widest mb-2">Sovereign Vault</span>
                                            <p className="text-xs text-zinc-500 font-mono uppercase leading-relaxed">
                                                Select and encrypt sensitive documentation for permanent, private blockchain archival.
                                            </p>
                                        </div>
                                        <div className="relative">
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleDocumentUpload} />
                                            <button className="w-full py-5 bg-green-600/10 border border-green-600/30 text-green-500 font-mono font-black uppercase text-xs tracking-widest hover:bg-green-600/20 transition-all flex items-center justify-center gap-3">
                                                <FiLock className="text-lg" /> Select File
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Node Metrics */}
                        <div className="p-10 border border-white/[0.05] bg-zinc-900/40 backdrop-blur-xl space-y-8">
                            <h3 className="text-xs font-mono font-black uppercase tracking-[0.4em] text-zinc-600 border-b border-white/5 pb-4">Network Node Metrics</h3>
                            <div className="grid grid-cols-2 gap-12 text-center md:text-left">
                                <div>
                                    <span className="block text-6xl font-mono font-black tracking-tighter italic">{signatures.length}</span>
                                    <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-widest mt-2 block">Attestations</span>
                                </div>
                                <div>
                                    <span className="block text-6xl font-mono font-black tracking-tighter italic text-zinc-400">${(signatures.length * 0.01).toFixed(2)}</span>
                                    <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-widest mt-2 block">Node Revenue</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Signature Chain (8/12) */}
                    <div className="lg:col-span-8 space-y-12">
                        <div className="flex items-center justify-between border-b border-white/[0.05] pb-6">
                            <h3 className="text-sm font-mono font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
                                <FiActivity className="text-zinc-600 animate-pulse text-lg" /> Signature Chain
                            </h3>
                            <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest italic">Immutable Narrative Ledger</span>
                        </div>

                        <div className="space-y-6">
                            {signatures.length === 0 ? (
                                <div className="py-40 text-center border border-dashed border-white/[0.05] bg-zinc-900/5 backdrop-blur-sm">
                                    <p className="font-mono text-xs text-zinc-500 uppercase tracking-[0.3em]">Chain is empty. Root your first intent.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {signatures.map((sig) => (
                                        <div key={sig.id} className="flex items-center justify-between p-8 border border-white/[0.03] bg-white/[0.01] backdrop-blur-sm group hover:bg-white/[0.03] hover:border-white/10 transition-all scale-[0.99] hover:scale-[1] duration-300">
                                            <div className="flex items-center gap-8">
                                                <div className="w-16 h-16 border border-white/[0.05] flex items-center justify-center text-zinc-700 group-hover:text-white transition-all bg-black/40">
                                                    {sig.signature_type === 'TLDRAW' ? <FiEdit3 size={24} /> : <FiLock size={24} />}
                                                </div>
                                                <div>
                                                    <span className="block font-mono font-black text-lg uppercase tracking-tight group-hover:text-white transition-colors">
                                                        {sig.metadata?.type || sig.signature_type}
                                                    </span>
                                                    <span className="block font-mono text-xs text-zinc-500 font-black tracking-widest mt-2 italic uppercase">
                                                        {new Date(sig.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-10">
                                                <div className="flex flex-col items-end hidden md:flex">
                                                    <span className="block font-mono text-[10px] text-zinc-600 uppercase mb-2 tracking-widest italic">Tx Protocol Hash</span>
                                                    <span className="font-mono text-xs text-zinc-500 font-black tracking-tighter truncate max-w-[140px] uppercase">{sig.txid}</span>
                                                </div>
                                                <a
                                                    href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                    target="_blank"
                                                    className="p-4 border border-white/[0.05] text-zinc-600 hover:text-white hover:border-white/20 transition-all bg-white/[0.02]"
                                                    title="Open Ledger Explorer"
                                                >
                                                    <FiExternalLink size={20} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                            }
                        </div>
                    </div>
                </div>

                {/* Session Management */}
                <footer className="pt-32 pb-12 border-t border-white/[0.05] flex flex-col items-center space-y-10">
                    <div className="text-center space-y-2">
                        <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.5em] italic">
                            Verification is the bridge between digital intent and biological proof.
                        </p>
                        <p className="font-mono text-[8px] text-zinc-800 uppercase tracking-[0.3em]">
                            Bit-Sign Protocol // v1.0.4-genesis
                        </p>
                    </div>

                    <Link
                        href="/api/auth/logout"
                        className="px-10 py-3 border border-red-900/20 text-red-500/30 font-mono text-[10px] font-black uppercase hover:bg-red-500/10 hover:text-red-500 transition-all tracking-[0.3em]"
                    >
                        Revoke Sovereign Session
                    </Link>
                </footer>

                {/* Modals and Overlays */}
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

                            <div className="flex flex-col items-center gap-3">
                                <span className="font-mono text-sm text-white font-black uppercase tracking-[1em] italic translate-x-[0.5em]">Inscribing</span>
                                <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest italic">Commiting intent to global ledger...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </div>
    );
}
