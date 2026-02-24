'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bufferToBase64 } from '@/lib/attestation';
import SovereignSignature from '@/components/SovereignSignature';
import MediaCapture from '@/components/MediaCapture';
import E2ESetupBanner from '@/components/E2ESetupBanner';
import ShareModal from '@/components/ShareModal';
import DocumentSigner from '@/components/DocumentSigner';
import type { SignaturePlacement } from '@/components/DocumentSigner';
import {
    FiLock,
    FiFileText,
    FiEdit3,
    FiActivity,
    FiExternalLink,
    FiCpu,
    FiCamera,
    FiDownload,
    FiChevronDown,
    FiChevronUp,
    FiZap,
    FiGithub,
    FiX,
    FiShield,
    FiCheck,
    FiShare2,
    FiUsers,
    FiTwitter,
    FiLinkedin,
    FiMail,
    FiMessageCircle,
    FiMonitor
} from 'react-icons/fi';

interface Signature {
    id: string;
    signature_type: string;
    txid: string;
    created_at: string;
    metadata: any;
    wallet_signed?: boolean;
    wallet_signature?: string;
    wallet_address?: string;
    encryption_version?: number;
}

interface Identity {
    token_id: string;
    metadata: any;
    avatar_url?: string;
    github_handle?: string;
    github_id?: string;
    github_metadata?: any;
    registered_signature_id?: string;
    registered_signature_txid?: string;
}

interface SharedDocument {
    id: string;
    document_id: string;
    document_type: string;
    grantor_handle: string;
    wrapped_key: string;
    ephemeral_public_key: string;
    created_at: string;
    signature_type?: string;
    metadata?: any;
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
    const [expandedSig, setExpandedSig] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<{ url: string; type: string } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [registeredSignatureId, setRegisteredSignatureId] = useState<string | null>(null);
    const [hasE2EKeys, setHasE2EKeys] = useState<boolean | null>(null);
    const [shareModal, setShareModal] = useState<{ documentId: string; documentType: string; itemType?: string; itemLabel?: string } | null>(null);
    const [sharedWithMe, setSharedWithMe] = useState<SharedDocument[]>([]);
    const [sealingDoc, setSealingDoc] = useState<{ id: string; blobUrl: string } | null>(null);
    const [registeredSignatureSvg, setRegisteredSignatureSvg] = useState<string | null>(null);

    const registerSignature = async (sigId: string) => {
        setIsProcessing(true);
        try {
            const res = await fetch('/api/bitsign/register-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature_id: sigId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to register');
            setRegisteredSignatureId(sigId);
        } catch (error: any) {
            console.error('Register signature failed:', error);
            alert(error?.message || 'Failed to register signature.');
        } finally {
            setIsProcessing(false);
        }
    };

    const attestSignature = async (sigId: string) => {
        setIsProcessing(true);
        try {
            const verifyRes = await fetch('/api/bitsign/handcash-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `I attest this item belongs to $${handle}`,
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Wallet verification failed');

            const attestRes = await fetch(`/api/bitsign/signatures/${sigId}/attest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_signature: verifyData.signature,
                    wallet_address: verifyData.walletAddress,
                    payment_txid: verifyData.paymentTxid,
                })
            });
            const attestData = await attestRes.json();
            if (!attestRes.ok) throw new Error(attestData.error || 'Attestation failed');

            setSignatures(prev => prev.map(s =>
                s.id === sigId ? { ...s, wallet_signed: true, wallet_address: verifyData.walletAddress } : s
            ));
        } catch (error: any) {
            console.error('Attest failed:', error);
            alert(error?.message || 'Failed to sign with wallet.');
        } finally {
            setIsProcessing(false);
        }
    };

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
            checkE2EKeys();
            fetchSharedWithMe();
            fetchRegisteredSignatureSvg();
        } else {
            setLoading(false);
        }
    }, []);

    const checkE2EKeys = async () => {
        try {
            const res = await fetch('/api/bitsign/keypair');
            if (!res.ok) { setHasE2EKeys(false); return; }
            const data = await res.json();
            setHasE2EKeys(!!data.public_key);
        } catch {
            setHasE2EKeys(false);
        }
    };

    const fetchSharedWithMe = async () => {
        try {
            const res = await fetch('/api/bitsign/shared-with-me');
            if (!res.ok) return;
            const data = await res.json();
            setSharedWithMe(data.grants || []);
        } catch {
            // Not critical
        }
    };

    const fetchRegisteredSignatureSvg = async () => {
        try {
            const res = await fetch('/api/bitsign/registered-signature');
            if (!res.ok) return;
            const data = await res.json();
            if (data.registered && data.svg) {
                setRegisteredSignatureSvg(data.svg);
            }
        } catch {
            // Not critical
        }
    };

    const openDocumentSigner = async (sigId: string) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/preview`);
            if (!res.ok) throw new Error('Failed to load document');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            setSealingDoc({ id: sigId, blobUrl });
        } catch (error) {
            console.error('Failed to open document for signing:', error);
            alert('Failed to load document preview.');
        }
    };

    const handleSeal = async (compositeBase64: string, placement: SignaturePlacement) => {
        if (!handle) return;
        setIsProcessing(true);
        setSealingDoc(null);
        try {
            // Wallet verify ($0.01)
            const verifyRes = await fetch('/api/bitsign/handcash-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `I seal this document with my registered signature as $${handle}`,
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Wallet verification failed');

            const sealRes = await fetch('/api/bitsign/seal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalDocumentId: sealingDoc?.id,
                    compositeData: compositeBase64,
                    placement,
                    walletSignature: verifyData.signature,
                    walletAddress: verifyData.walletAddress,
                    paymentTxid: verifyData.paymentTxid,
                })
            });
            const sealData = await sealRes.json();
            if (!sealRes.ok) throw new Error(sealData.error || 'Seal failed');

            // Add sealed doc to vault
            setSignatures(prev => [{
                id: sealData.id,
                signature_type: 'SEALED_DOCUMENT',
                txid: sealData.txid,
                created_at: new Date().toISOString(),
                metadata: { type: 'Sealed Document', mimeType: 'image/png' },
                wallet_signed: true,
                wallet_address: verifyData.walletAddress,
            }, ...prev]);
        } catch (error: any) {
            console.error('Seal failed:', error);
            alert(error?.message || 'Failed to seal document.');
        } finally {
            setIsProcessing(false);
        }
    };

    const fetchEncryptionSeed = async () => {
        try {
            const res = await fetch('/api/bitsign/encryption-seed');
            if (!res.ok) return;
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
            if (data.identity) {
                setIdentity(data.identity);
                if (data.identity.registered_signature_id) {
                    setRegisteredSignatureId(data.identity.registered_signature_id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTldrawSave = async (signatureData: { svg: string; json: string }) => {
        if (!handle) { alert('Please sign in first.'); return; }
        setIsProcessing(true);
        try {
            const encoder = new TextEncoder();
            const svgBytes = encoder.encode(signatureData.svg);
            const base64 = bufferToBase64(svgBytes.buffer);

            const response = await fetch('/api/bitsign/inscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plaintextData: base64,
                    handle,
                    signatureType: 'TLDRAW',
                    metadata: { type: 'Hand-written Signature' }
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed');

            setSignatures(prev => [{
                id: data.signature?.id || data.txid,
                signature_type: 'TLDRAW',
                txid: data.txid,
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
        if (!handle) return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = bufferToBase64(arrayBuffer);

            const type = captureMode === 'PHOTO' ? 'CAMERA' : 'VIDEO';
            const label = captureMode === 'PHOTO' ? 'Camera Proof' : 'Video Witness';

            const response = await fetch('/api/bitsign/inscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plaintextData: base64,
                    handle,
                    signatureType: type,
                    metadata: { type: label, mimeType: blob.type }
                })
            });
            const data = await response.json();
            if (response.status === 401) {
                alert('Session expired. Please sign in again to upload new items.');
                window.location.href = '/api/auth/handcash';
                return;
            }
            if (!response.ok) throw new Error(data.error || 'Failed');

            const newId = data.signature?.id || data.txid;
            setSignatures(prev => [{
                id: newId,
                signature_type: type,
                txid: data.txid,
                created_at: new Date().toISOString(),
                metadata: { type: label, mimeType: blob.type }
            }, ...prev]);

            // Auto-set camera photos as profile picture
            if (type === 'CAMERA' && data.signature?.id) {
                try {
                    const ppRes = await fetch('/api/bitsign/profile-picture', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ signatureId: data.signature.id })
                    });
                    if (ppRes.ok) {
                        const ppData = await ppRes.json();
                        if (ppData.avatarUrl && identity) {
                            setIdentity({ ...identity, avatar_url: ppData.avatarUrl });
                        }
                    }
                } catch {
                    // Non-critical — avatar update failed silently
                }
            }
        } catch (error: any) {
            console.error('Media capture failed:', error);
            alert(error?.message || 'Failed to save. Please try again.');
        } finally {
            setCaptureMode(null);
            setIsProcessing(false);
        }
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !handle) return;

        setIsProcessing(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const arrayBuffer = await file.arrayBuffer();
                const base64 = bufferToBase64(arrayBuffer);

                const response = await fetch('/api/bitsign/inscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plaintextData: base64,
                        handle,
                        signatureType: 'DOCUMENT',
                        metadata: { type: 'Document', fileName: file.name, mimeType: file.type }
                    })
                });
                const data = await response.json();
                if (response.status === 401) {
                    alert('Session expired. Please sign in again to upload new items.');
                    window.location.href = '/api/auth/handcash';
                    return;
                }
                if (!response.ok) throw new Error(data.error || 'Failed');

                setSignatures(prev => [{
                    id: data.signature?.id || data.txid,
                    signature_type: 'DOCUMENT',
                    txid: data.txid,
                    created_at: new Date().toISOString(),
                    metadata: { type: 'Document', fileName: file.name, mimeType: file.type }
                }, ...prev]);
            }
        } catch (error: any) {
            console.error('Document upload failed:', error);
            alert(error?.message || 'Failed to upload. Please try again.');
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

    const deleteSignature = async (sigId: string) => {
        if (!confirm('Delete this item permanently?')) return;
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/delete`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Delete failed');
            }
            setSignatures(prev => prev.filter(s => s.id !== sigId));
            if (expandedSig === sigId) {
                setExpandedSig(null);
                setPreviewData(null);
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete. Please try again.');
        }
    };

    const downloadSignature = async (sigId: string, fileName?: string) => {
        try {
            const a = document.createElement('a');
            a.href = `/api/bitsign/signatures/${sigId}/preview`;
            a.download = fileName || `bit-sign-${sigId.slice(0, 8)}`;
            a.click();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download. Please try again.');
        }
    };

    const previewSignature = async (sig: Signature) => {
        if (expandedSig === sig.id) {
            setExpandedSig(null);
            setPreviewData(null);
            return;
        }
        setExpandedSig(sig.id);
        setPreviewLoading(true);
        setPreviewData(null);

        try {
            const previewUrl = `/api/bitsign/signatures/${sig.id}/preview`;
            const res = await fetch(previewUrl);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
                if (res.status === 422) {
                    setPreviewData({ url: '', type: 'decrypt-failed' });
                    return;
                }
                if (res.status === 404 && errData.error === 'No encrypted data') {
                    setPreviewData({ url: '', type: 'no-data' });
                    return;
                }
                if (res.status === 400) {
                    setPreviewData({ url: '', type: 'no-key' });
                    return;
                }
                throw new Error(errData.error || 'Failed to load');
            }

            const contentType = res.headers.get('content-type') || '';

            if (sig.signature_type === 'TLDRAW' || contentType.includes('svg')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'svg' });
            } else if (contentType.startsWith('image/')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'image' });
            } else if (contentType === 'application/pdf') {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'pdf' });
            } else if (contentType.startsWith('video/')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'video' });
            } else {
                setPreviewData({ url: '', type: 'unsupported' });
            }
        } catch (error) {
            console.error('Preview failed:', error);
            setPreviewData({ url: '', type: 'error' });
        } finally {
            setPreviewLoading(false);
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
                <a
                    href="/api/auth/handcash?returnTo=/user/account"
                    className="px-8 py-3 bg-white text-black font-medium rounded-md transition-all hover:bg-zinc-200 text-sm"
                >
                    Sign in with HandCash
                </a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-zinc-800 selection:text-white overflow-x-hidden">
            <div className="relative z-10 p-6 pt-24 max-w-7xl mx-auto space-y-12 pb-40">
                {/* Header */}
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
                                <p className="text-zinc-500 text-sm mt-1">Identity Vault</p>
                            </div>

                            {identity && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {[
                                        { id: 'github', label: 'GitHub', icon: FiGithub, active: true, linked: !!identity.github_handle, handle: identity.github_handle, authUrl: '/api/auth/github' },
                                        { id: 'google', label: 'Google', icon: FiMail, active: false, linked: false },
                                        { id: 'twitter', label: 'X', icon: FiTwitter, active: false, linked: false },
                                        { id: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, active: false, linked: false },
                                        { id: 'discord', label: 'Discord', icon: FiMessageCircle, active: false, linked: false },
                                        { id: 'microsoft', label: 'Microsoft', icon: FiMonitor, active: false, linked: false },
                                    ].map((provider) => {
                                        if (provider.linked && provider.handle) {
                                            return (
                                                <div key={provider.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border border-green-900/40 text-sm text-zinc-400 rounded-md">
                                                    <provider.icon className="text-green-400" size={14} />
                                                    <span className="text-white font-medium">{provider.handle}</span>
                                                </div>
                                            );
                                        }
                                        if (provider.active && !provider.linked) {
                                            return (
                                                <button
                                                    key={provider.id}
                                                    onClick={() => window.location.href = provider.authUrl!}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-500 text-sm text-zinc-500 hover:text-white transition-all rounded-md"
                                                >
                                                    <provider.icon size={14} />
                                                    <span>{provider.label}</span>
                                                </button>
                                            );
                                        }
                                        return (
                                            <div key={provider.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-900 text-sm text-zinc-700 rounded-md opacity-40 cursor-not-allowed">
                                                <provider.icon size={14} />
                                                <span>{provider.label}</span>
                                                <span className="text-[10px] text-zinc-600 ml-0.5">Soon</span>
                                            </div>
                                        );
                                    })}
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

                {/* E2E Setup Banner */}
                {hasE2EKeys === false && (
                    <E2ESetupBanner onSetupComplete={() => setHasE2EKeys(true)} />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
                    {/* Left Col: Verification Methods */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-zinc-400">Verification Methods</h3>
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
                                        {activeCaptureTab === 'video' && 'Record a message, then share it encrypted with any HandCash handle.'}
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

                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-black p-5 border border-zinc-900 rounded-md">
                                <span className="block text-xs text-zinc-500 mb-1">Vault Items</span>
                                <span className="block text-2xl font-semibold text-white">{signatures.length}</span>
                            </div>
                            <div className="bg-black p-5 border border-zinc-900 rounded-md">
                                <span className="block text-xs text-zinc-500 mb-1">Shared With Me</span>
                                <span className="block text-2xl font-semibold text-white">{sharedWithMe.length}</span>
                            </div>
                            <div className="bg-black p-5 border border-zinc-900 rounded-md">
                                <span className="block text-xs text-zinc-500 mb-1">Encryption</span>
                                <span className={`text-sm font-semibold flex items-center gap-1.5 ${hasE2EKeys ? 'text-green-400' : 'text-zinc-600'}`}>
                                    <FiLock size={14} />
                                    {hasE2EKeys ? 'E2E Active' : 'Not Set Up'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Vault Items */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Your Vault
                            </h3>
                        </div>

                        <div className="space-y-2">
                            {signatures.length === 0 ? (
                                <div className="py-24 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-md text-center">
                                    <FiEdit3 className="text-zinc-700 text-3xl mb-4" />
                                    <p className="text-base text-zinc-400 font-medium">No vault items yet</p>
                                    <p className="text-sm text-zinc-600 mt-1">Create your first signature or upload a document.</p>
                                </div>
                            ) : (
                                signatures.map((sig) => {
                                    const isOnChain = sig.txid && !sig.txid.startsWith('pending-');
                                    const isExpanded = expandedSig === sig.id;
                                    const isRegistered = sig.id === registeredSignatureId;
                                    const isSigned = sig.wallet_signed;
                                    return (
                                    <div key={sig.id} className={`border rounded-md overflow-hidden ${isRegistered ? 'border-green-800' : 'border-zinc-900'}`}>
                                        <button
                                            onClick={() => previewSignature(sig)}
                                            className="w-full text-left bg-black hover:bg-zinc-950 transition-colors p-4 flex items-center gap-4"
                                        >
                                            <div className="text-zinc-500 shrink-0">
                                                {sig.signature_type === 'TLDRAW' && <FiEdit3 size={18} />}
                                                {sig.signature_type === 'CAMERA' && <FiCamera size={18} />}
                                                {sig.signature_type === 'VIDEO' && <FiActivity size={18} />}
                                                {sig.signature_type === 'DOCUMENT' && <FiFileText size={18} />}
                                                {sig.signature_type === 'SEALED_DOCUMENT' && <FiShield size={18} className="text-amber-500" />}
                                                {sig.signature_type === 'IDENTITY_MINT' && <FiCpu size={18} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-white truncate">
                                                        {sig.metadata?.fileName || sig.metadata?.type || sig.signature_type}
                                                    </span>
                                                    {isRegistered && (
                                                        <span className="px-1.5 py-0.5 bg-green-950 text-green-400 text-[10px] rounded shrink-0 flex items-center gap-1">
                                                            <FiCheck size={10} /> Registered
                                                        </span>
                                                    )}
                                                    {sig.signature_type === 'SEALED_DOCUMENT' && (
                                                        <span className="px-1.5 py-0.5 bg-amber-950 text-amber-400 text-[10px] rounded shrink-0 flex items-center gap-1">
                                                            <FiShield size={10} /> Sealed
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="block text-xs text-zinc-600">
                                                    {new Date(sig.created_at).toLocaleDateString()} at {new Date(sig.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {isSigned ? (
                                                <span className="px-2 py-1 bg-green-950/30 text-green-400 text-xs rounded shrink-0 flex items-center gap-1">
                                                    <FiShield size={10} /> Signed
                                                </span>
                                            ) : isOnChain ? (
                                                <span className="px-2 py-1 bg-green-950/30 text-green-400 text-xs rounded shrink-0">On chain</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-zinc-900 text-zinc-500 text-xs rounded shrink-0">Unsigned</span>
                                            )}

                                            <div className="text-zinc-600 shrink-0">
                                                {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-zinc-900 bg-zinc-950 p-4 space-y-4">
                                                {previewLoading ? (
                                                    <div className="flex items-center justify-center py-12">
                                                        <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full opacity-20" />
                                                    </div>
                                                ) : previewData?.type === 'svg' ? (
                                                    <div className="bg-white rounded-md p-4 flex items-center justify-center">
                                                        <img src={previewData.url} alt="Signature" className="max-h-40 w-auto" />
                                                    </div>
                                                ) : previewData?.type === 'image' ? (
                                                    <div className="bg-white rounded-md overflow-hidden">
                                                        <img src={previewData.url} alt="Document" className="max-h-[400px] w-full object-contain" />
                                                    </div>
                                                ) : previewData?.type === 'pdf' ? (
                                                    <iframe src={previewData.url} className="w-full h-[500px] rounded-md border border-zinc-800" />
                                                ) : previewData?.type === 'video' ? (
                                                    <video src={previewData.url} controls className="w-full max-h-[400px] rounded-md" />
                                                ) : previewData?.type === 'decrypt-failed' ? (
                                                    <div className="text-center py-6 space-y-2">
                                                        <FiLock className="mx-auto text-amber-500" size={24} />
                                                        <p className="text-sm text-amber-400">Unable to decrypt</p>
                                                        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                                                            Your encryption key may have changed since this was uploaded.
                                                            Try signing out and back in, then retry.
                                                        </p>
                                                    </div>
                                                ) : previewData?.type === 'no-data' ? (
                                                    <div className="text-center py-6 space-y-2">
                                                        <FiFileText className="mx-auto text-zinc-600" size={24} />
                                                        <p className="text-sm text-zinc-500">No encrypted data stored for this item</p>
                                                    </div>
                                                ) : previewData?.type === 'no-key' ? (
                                                    <div className="text-center py-6 space-y-2">
                                                        <FiLock className="mx-auto text-zinc-600" size={24} />
                                                        <p className="text-sm text-zinc-500">Encryption key not available. Please sign in again.</p>
                                                    </div>
                                                ) : previewData?.type === 'error' ? (
                                                    <p className="text-sm text-red-400 text-center py-4">Failed to load preview</p>
                                                ) : previewData?.type === 'unsupported' ? (
                                                    <p className="text-sm text-zinc-500 text-center py-4">Preview not available for this file type. Use download instead.</p>
                                                ) : null}

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {sig.signature_type === 'DOCUMENT' && registeredSignatureSvg && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openDocumentSigner(sig.id); }}
                                                            className="px-3 py-2 bg-amber-600 text-black text-sm font-medium rounded-md hover:bg-amber-500 transition-all flex items-center gap-2"
                                                        >
                                                            <FiEdit3 size={14} /> Place Signature & Seal
                                                        </button>
                                                    )}
                                                    {sig.signature_type === 'TLDRAW' && isOnChain && !isRegistered && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); registerSignature(sig.id); }}
                                                            className="px-3 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2"
                                                        >
                                                            <FiEdit3 size={14} /> Use as Signing Signature
                                                        </button>
                                                    )}
                                                    {!isSigned && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); attestSignature(sig.id); }}
                                                            className="px-3 py-2 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                        >
                                                            <FiShield size={14} /> Sign with HandCash
                                                        </button>
                                                    )}
                                                    {hasE2EKeys && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: sig.signature_type, itemLabel: sig.metadata?.type || sig.signature_type }); }}
                                                            className="px-3 py-2 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                        >
                                                            <FiShare2 size={14} /> Share
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); downloadSignature(sig.id, sig.metadata?.fileName); }}
                                                        className="px-3 py-2 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                    >
                                                        <FiDownload size={14} /> Download
                                                    </button>
                                                    {isOnChain && (
                                                        <a
                                                            href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                            target="_blank"
                                                            className="px-3 py-2 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                        >
                                                            <FiExternalLink size={14} /> View on Chain
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteSignature(sig.id); }}
                                                        className="px-3 py-2 border border-red-900/30 bg-black text-red-900 text-sm rounded-md hover:text-red-400 hover:border-red-800 transition-all flex items-center gap-2 ml-auto"
                                                    >
                                                        <FiX size={14} /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Shared With Me */}
                        {sharedWithMe.length > 0 && (
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                                    <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                        <FiUsers size={14} /> Shared With Me ({sharedWithMe.length})
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {sharedWithMe.map((doc) => (
                                        <div key={doc.id} className="border border-zinc-900 rounded-md bg-black p-4 flex items-center gap-4">
                                            <div className="text-zinc-500 shrink-0">
                                                <FiShare2 size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium text-white truncate block">
                                                    {doc.metadata?.fileName || doc.metadata?.type || doc.document_type}
                                                </span>
                                                <span className="text-xs text-zinc-600">
                                                    From ${doc.grantor_handle} &middot; {new Date(doc.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span className="px-2 py-1 bg-blue-950/30 text-blue-400 text-xs rounded shrink-0">
                                                E2E Encrypted
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <footer className="pt-16 border-t border-zinc-900 space-y-6">
                    <div className="flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
                        <Link
                            href="/user/account/advanced"
                            className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
                        >
                            <FiFileText size={12} /> Documents
                        </Link>
                        <a
                            href="/api/auth/logout"
                            className="text-sm text-red-900 hover:text-red-500 transition-colors"
                        >
                            Sign Out
                        </a>
                    </div>
                    <p className="text-[11px] tracking-[0.25em] uppercase text-zinc-700 text-center">
                        A Bitcoin Corporation Product
                    </p>
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

                {sealingDoc && registeredSignatureSvg && (
                    <DocumentSigner
                        documentUrl={sealingDoc.blobUrl}
                        signatureSvg={registeredSignatureSvg}
                        onSeal={handleSeal}
                        onCancel={() => setSealingDoc(null)}
                    />
                )}

                {shareModal && (
                    <ShareModal
                        documentId={shareModal.documentId}
                        documentType={shareModal.documentType}
                        itemType={shareModal.itemType}
                        itemLabel={shareModal.itemLabel}
                        onClose={() => setShareModal(null)}
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
