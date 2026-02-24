'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { bufferToBase64 } from '@/lib/attestation';
import SovereignSignature from '@/components/SovereignSignature';
import MediaCapture from '@/components/MediaCapture';
import PhoneCaptureModal from '@/components/PhoneCaptureModal';
import E2ESetupBanner from '@/components/E2ESetupBanner';
import ShareModal from '@/components/ShareModal';
import SignatureExplorer from '@/components/SignatureExplorer';
import DocumentCanvas from '@/components/DocumentCanvas';
import type { PlacedElement } from '@/components/DocumentCanvas';
import { pdfToImage } from '@/lib/pdf-to-image';
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
    FiMonitor,
    FiSmartphone,
    FiEye,
    FiInbox,
    FiCopy,
    FiSend,
    FiLoader,
    FiAlertCircle,
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
    google_email?: string;
    google_id?: string;
    twitter_handle?: string;
    twitter_id?: string;
    linkedin_name?: string;
    linkedin_id?: string;
    discord_handle?: string;
    discord_id?: string;
    microsoft_email?: string;
    microsoft_id?: string;
    registered_signature_id?: string;
    registered_signature_txid?: string;
    identity_strength?: number;
}

interface Strand {
    id: string;
    strand_type: string;
    strand_subtype?: string;
    strand_txid?: string;
    label?: string;
    signature_id?: string;
    provider_handle?: string;
    created_at: string;
    metadata?: any;
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

interface CoSignRequest {
    id: string;
    document_id: string;
    sender_handle: string;
    recipient_handle: string;
    recipient_email?: string;
    status: string;
    response_document_id?: string;
    message?: string;
    created_at: string;
    signed_at?: string;
    document_name: string;
    document_txid?: string;
}

export default function AccountPage() {
    const [handle, setHandle] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [captureMode, setCaptureMode] = useState<'PHOTO' | 'VIDEO' | null>(null);
    const [showDeviceChoice, setShowDeviceChoice] = useState<'PHOTO' | 'VIDEO' | null>(null);
    const [phoneCaptureMode, setPhoneCaptureMode] = useState<'PHOTO' | 'VIDEO' | null>(null);
    const [encryptionSeed, setEncryptionSeed] = useState<string | null>(null);
    const [uploadInputKey, setUploadInputKey] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedSig, setExpandedSig] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<{ url: string; type: string } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [registeredSignatureId, setRegisteredSignatureId] = useState<string | null>(null);
    const [hasE2EKeys, setHasE2EKeys] = useState<boolean | null>(null);
    const [shareModal, setShareModal] = useState<{ documentId: string; documentType: string; itemType?: string; itemLabel?: string } | null>(null);
    const [sharedWithMe, setSharedWithMe] = useState<SharedDocument[]>([]);
    const [registeredSignatureSvg, setRegisteredSignatureSvg] = useState<string | null>(null);
    const [strands, setStrands] = useState<Strand[]>([]);
    const [coSignRequests, setCoSignRequests] = useState<CoSignRequest[]>([]);
    const [sentCoSignRequests, setSentCoSignRequests] = useState<CoSignRequest[]>([]);
    const [coSignModal, setCoSignModal] = useState<{ documentId: string; documentName: string } | null>(null);
    const [copiedTxid, setCopiedTxid] = useState<string | null>(null);

    // Workspace state
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [selectedDocBlobUrl, setSelectedDocBlobUrl] = useState<string | null>(null);
    const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);

    // Split vault items into categories
    const signaturesOnly = useMemo(() =>
        signatures.filter(s => s.signature_type === 'TLDRAW'),
        [signatures]
    );
    const mediaItems = useMemo(() =>
        signatures.filter(s => s.signature_type === 'CAMERA' || s.signature_type === 'VIDEO'),
        [signatures]
    );
    const documents = useMemo(() => {
        // Collect IDs of originals that have been sealed
        const sealedOriginalIds = new Set(
            signatures
                .filter(s => s.signature_type === 'SEALED_DOCUMENT' && s.metadata?.originalDocumentId)
                .map(s => s.metadata.originalDocumentId)
        );
        return signatures.filter(s =>
            (s.signature_type === 'DOCUMENT' && !sealedOriginalIds.has(s.id)) ||
            s.signature_type === 'SEALED_DOCUMENT'
        );
    }, [signatures]);

    const getStrengthLabel = (score: number) => {
        if (score >= 20) return { level: 4, label: 'Sovereign', color: 'text-amber-400' };
        if (score >= 10) return { level: 3, label: 'Strong', color: 'text-green-400' };
        if (score >= 5) return { level: 2, label: 'Verified', color: 'text-blue-400' };
        return { level: 1, label: 'Basic', color: 'text-zinc-400' };
    };

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
            const strength = identity?.identity_strength || 0;
            const strengthInfo = getStrengthLabel(strength);
            const manifest = {
                handle: `$${handle}`,
                root: {
                    token_id: identity?.token_id,
                    symbol: identity?.metadata?.symbol || `$${handle?.toUpperCase()}`,
                },
                strands: strands.map(s => ({
                    type: s.strand_type,
                    subtype: s.strand_subtype,
                    strand_txid: s.strand_txid,
                    label: s.label,
                    timestamp: s.created_at,
                })),
                identity_strength: {
                    score: strength,
                    level: strengthInfo.level,
                    label: strengthInfo.label,
                },
                chain: [
                    identity?.token_id,
                    ...strands.filter(s => s.strand_txid).map(s => s.strand_txid),
                ].filter(Boolean),
                attestations: signatures.map(s => ({
                    type: s.signature_type,
                    txid: s.txid,
                    timestamp: s.created_at,
                    label: s.metadata?.type
                })),
                timestamp: new Date().toISOString(),
                protocol: "BIT-SIGN v2.0.0-strands"
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
            fetchCoSignRequests();
            fetchSentCoSignRequests();
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

    const fetchCoSignRequests = async () => {
        try {
            const res = await fetch('/api/bitsign/co-sign-request');
            if (!res.ok) return;
            const data = await res.json();
            setCoSignRequests(data.requests || []);
        } catch {
            // Not critical
        }
    };

    const fetchSentCoSignRequests = async () => {
        try {
            const res = await fetch('/api/bitsign/co-sign-requests/sent');
            if (!res.ok) return;
            const data = await res.json();
            setSentCoSignRequests(data.requests || []);
        } catch {
            // Not critical
        }
    };

    const copyTxid = (txid: string) => {
        navigator.clipboard.writeText(txid);
        setCopiedTxid(txid);
        setTimeout(() => setCopiedTxid(null), 2000);
    };

    const submitCoSignRequest = async (recipientHandle: string, recipientEmail: string, message: string) => {
        if (!coSignModal) return;
        try {
            const res = await fetch('/api/bitsign/co-sign-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: coSignModal.documentId,
                    recipientHandle: recipientHandle || undefined,
                    recipientEmail: recipientEmail || undefined,
                    message: message || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create co-sign request');
            setCoSignModal(null);
            fetchSentCoSignRequests();
            return data;
        } catch (error: any) {
            throw error;
        }
    };

    // After co-signing a shared document, link it to the co-sign request
    const handleCoSignResponse = async (sealedDocId: string, originalDocId: string) => {
        // Find matching co-sign request
        const matchingReq = coSignRequests.find(r => r.document_id === originalDocId && r.status === 'pending');
        if (!matchingReq) return;

        try {
            await fetch('/api/bitsign/co-sign-respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: matchingReq.id,
                    responseDocumentId: sealedDocId,
                }),
            });
            fetchCoSignRequests();
        } catch {
            // Non-critical — the sealed document is already created
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

    // Open document in the workspace canvas
    const openDocumentInCanvas = async (sigId: string) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/preview`);
            if (!res.ok) throw new Error('Failed to load document');
            const contentType = res.headers.get('content-type') || '';

            let blob: Blob;
            if (contentType === 'application/pdf') {
                const arrayBuffer = await res.arrayBuffer();
                blob = await pdfToImage(arrayBuffer);
            } else if (contentType.startsWith('image/')) {
                blob = await res.blob();
            } else {
                alert('Only image documents (PNG, JPEG) and PDFs can be opened in the signing workspace.');
                return;
            }

            const blobUrl = URL.createObjectURL(blob);
            // Clean up previous blob URL
            if (selectedDocBlobUrl && selectedDocBlobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(selectedDocBlobUrl);
            }
            setSelectedDocumentId(sigId);
            setSelectedDocBlobUrl(blobUrl);
            setPlacedElements([]);
        } catch (error) {
            console.error('Failed to open document for signing:', error);
            alert('Failed to load document preview.');
        }
    };

    const closeDocumentCanvas = () => {
        if (selectedDocBlobUrl && selectedDocBlobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(selectedDocBlobUrl);
        }
        setSelectedDocumentId(null);
        setSelectedDocBlobUrl(null);
        setPlacedElements([]);
    };

    // Multi-element seal handler
    const handleSeal = async (compositeBase64: string, elements: PlacedElement[]) => {
        if (!handle || !selectedDocumentId) return;
        // Grab original doc metadata before closing canvas
        const originalDoc = signatures.find(s => s.id === selectedDocumentId);
        const originalFileName = originalDoc?.metadata?.fileName;
        setIsProcessing(true);
        closeDocumentCanvas();
        try {
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
                    originalDocumentId: selectedDocumentId,
                    compositeData: compositeBase64,
                    elements,
                    walletSignature: verifyData.signature,
                    walletAddress: verifyData.walletAddress,
                    paymentTxid: verifyData.paymentTxid,
                })
            });
            const sealData = await sealRes.json();
            if (!sealRes.ok) throw new Error(sealData.error || 'Seal failed');

            setSignatures(prev => [{
                id: sealData.id,
                signature_type: 'SEALED_DOCUMENT',
                txid: sealData.txid,
                created_at: new Date().toISOString(),
                metadata: { type: 'Sealed Document', mimeType: 'image/png', originalDocumentId: selectedDocumentId, originalFileName },
                wallet_signed: true,
                wallet_address: verifyData.walletAddress,
            }, ...prev]);

            // If this was a co-sign, link the response
            handleCoSignResponse(sealData.id, selectedDocumentId!);
        } catch (error: any) {
            console.error('Seal failed:', error);
            alert(error?.message || 'Failed to seal document.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Co-sign handler for shared documents
    const openCoSign = async (doc: SharedDocument) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${doc.document_id}/preview`);
            if (!res.ok) throw new Error('Failed to load shared document');
            const contentType = res.headers.get('content-type') || '';

            let blob: Blob;
            if (contentType === 'application/pdf') {
                const arrayBuffer = await res.arrayBuffer();
                blob = await pdfToImage(arrayBuffer);
            } else if (contentType.startsWith('image/')) {
                blob = await res.blob();
            } else {
                alert('Only image documents (PNG, JPEG) and PDFs can be co-signed in the workspace.');
                return;
            }

            const blobUrl = URL.createObjectURL(blob);
            if (selectedDocBlobUrl && selectedDocBlobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(selectedDocBlobUrl);
            }
            setSelectedDocumentId(doc.document_id);
            setSelectedDocBlobUrl(blobUrl);
            setPlacedElements([]);
        } catch (error) {
            console.error('Failed to open shared document for co-signing:', error);
            alert('Failed to load shared document.');
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
                setIdentity({ ...data.identity, identity_strength: data.identity_strength || data.identity.identity_strength || 0 });
                if (data.identity.registered_signature_id) {
                    setRegisteredSignatureId(data.identity.registered_signature_id);
                }
            }
            if (data.strands) setStrands(data.strands);
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

    const handleMediaCapture = async (blob: Blob, modeOverride?: 'PHOTO' | 'VIDEO') => {
        if (!handle) return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = bufferToBase64(arrayBuffer);

            const activeMode = modeOverride || captureMode;
            const type = activeMode === 'PHOTO' ? 'CAMERA' : 'VIDEO';
            const label = activeMode === 'PHOTO' ? 'Camera Proof' : 'Video Witness';

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
            if (response.status === 413) {
                throw new Error('File too large. Videos must be under 3MB. Try a shorter recording.');
            }
            let data: any;
            try {
                data = await response.json();
            } catch {
                throw new Error(`Upload failed (${response.status}). The file may be too large.`);
            }
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
                    // Non-critical
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
                if (response.status === 413) {
                    throw new Error(`${file.name} is too large. Files must be under 3MB.`);
                }
                let data: any;
                try {
                    data = await response.json();
                } catch {
                    throw new Error(`Upload failed (${response.status}). ${file.name} may be too large.`);
                }
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
                    metadata: { type: 'Identity Root', symbol: `$${handle.toUpperCase()}` }
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

    const downloadSignature = async (sigId: string, sig?: Signature) => {
        try {
            let filename: string;
            if (sig?.metadata?.fileName) {
                filename = sig.metadata.fileName;
            } else if (sig?.signature_type === 'SEALED_DOCUMENT') {
                const date = new Date(sig.created_at).toISOString().slice(0, 10);
                const txShort = sig.txid && !sig.txid.startsWith('pending-') ? `-${sig.txid.slice(0, 8)}` : '';
                filename = `sealed-document-${date}${txShort}.png`;
            } else if (sig?.signature_type === 'TLDRAW') {
                filename = `signature-${sigId.slice(0, 8)}.svg`;
            } else if (sig?.signature_type === 'CAMERA') {
                filename = `photo-${sigId.slice(0, 8)}.jpg`;
            } else if (sig?.signature_type === 'VIDEO') {
                filename = `video-${sigId.slice(0, 8)}.webm`;
            } else {
                const ext = sig?.metadata?.mimeType?.split('/')[1] || 'bin';
                filename = `document-${sigId.slice(0, 8)}.${ext}`;
            }
            const a = document.createElement('a');
            a.href = `/api/bitsign/signatures/${sigId}/preview`;
            a.download = filename;
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
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            alert(`Test payment of $0.01 sent to $${handle}. TX: ${data.transactionId?.slice(0, 12)}...`);
        } catch (error: any) {
            console.error('Test verification failed:', error);
            alert(error?.message || 'Failed to send test alert');
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
                                        { id: 'google', label: 'Google', icon: FiMail, active: true, linked: !!identity.google_email, handle: identity.google_email, authUrl: '/api/auth/google' },
                                        { id: 'twitter', label: 'X', icon: FiTwitter, active: true, linked: !!identity.twitter_handle, handle: identity.twitter_handle ? `@${identity.twitter_handle}` : undefined, authUrl: '/api/auth/twitter' },
                                        { id: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, active: true, linked: !!identity.linkedin_name, handle: identity.linkedin_name, authUrl: '/api/auth/linkedin' },
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
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const s = getStrengthLabel(identity.identity_strength || 0);
                                    return (
                                        <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-950 border border-zinc-900 rounded-md">
                                            <FiShield className={s.color} size={16} />
                                            <div className="text-right">
                                                <span className="block text-xs text-zinc-500">Strength</span>
                                                <span className={`block text-sm font-medium ${s.color}`}>
                                                    Lv.{s.level} {s.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
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
                            </div>
                        )}
                    </div>
                </header>

                {/* E2E Setup Banner */}
                {hasE2EKeys === false && (
                    <E2ESetupBanner onSetupComplete={() => setHasE2EKeys(true)} />
                )}

                {/* Verification Methods — 4 tiles, click to open */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-zinc-400">Verification Methods</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button
                            onClick={() => setIsSignatureModalOpen(true)}
                            className="group relative p-5 border border-zinc-700 bg-zinc-900 rounded-md flex flex-col items-center justify-center gap-2 transition-all hover:border-zinc-500 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        >
                            <FiEdit3 className="text-xl" />
                            <div className="text-center">
                                <span className="block text-sm font-medium">Signature</span>
                                <span className="block text-xs text-zinc-600">Hand-drawn</span>
                            </div>
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowDeviceChoice(showDeviceChoice === 'PHOTO' ? null : 'PHOTO')}
                                className="group relative w-full p-5 border border-zinc-700 bg-zinc-900 rounded-md flex flex-col items-center justify-center gap-2 transition-all hover:border-zinc-500 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                            >
                                <FiCamera className="text-xl" />
                                <div className="text-center">
                                    <span className="block text-sm font-medium">Photo</span>
                                    <span className="block text-xs text-zinc-600">Camera</span>
                                </div>
                            </button>
                            {showDeviceChoice === 'PHOTO' && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-md overflow-hidden shadow-xl">
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setCaptureMode('PHOTO'); }}
                                        className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-3"
                                    >
                                        <FiMonitor size={16} /> Use this device
                                    </button>
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setPhoneCaptureMode('PHOTO'); }}
                                        className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-3 border-t border-zinc-800"
                                    >
                                        <FiSmartphone size={16} /> Use phone camera
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowDeviceChoice(showDeviceChoice === 'VIDEO' ? null : 'VIDEO')}
                                className="group relative w-full p-5 border border-zinc-700 bg-zinc-900 rounded-md flex flex-col items-center justify-center gap-2 transition-all hover:border-zinc-500 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                            >
                                <FiActivity className="text-xl" />
                                <div className="text-center">
                                    <span className="block text-sm font-medium">Video</span>
                                    <span className="block text-xs text-zinc-600">Recording</span>
                                </div>
                            </button>
                            {showDeviceChoice === 'VIDEO' && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-md overflow-hidden shadow-xl">
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setCaptureMode('VIDEO'); }}
                                        className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-3"
                                    >
                                        <FiMonitor size={16} /> Use this device
                                    </button>
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setPhoneCaptureMode('VIDEO'); }}
                                        className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-3 border-t border-zinc-800"
                                    >
                                        <FiSmartphone size={16} /> Use phone camera
                                    </button>
                                </div>
                            )}
                        </div>
                        <label className="group relative p-5 border border-zinc-700 bg-zinc-900 rounded-md flex flex-col items-center justify-center gap-2 transition-all hover:border-zinc-500 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer">
                            <input key={uploadInputKey} type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => { handleDocumentUpload(e); setUploadInputKey(k => k + 1); }} />
                            <FiFileText className="text-xl" />
                            <div className="text-center">
                                <span className="block text-sm font-medium">Document</span>
                                <span className="block text-xs text-zinc-600">Upload</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-black p-4 border border-zinc-900 rounded-md">
                        <span className="block text-xs text-zinc-500 mb-1">Vault Items</span>
                        <span className="block text-2xl font-semibold text-white">{signatures.length}</span>
                    </div>
                    <div className="bg-black p-4 border border-zinc-900 rounded-md">
                        <span className="block text-xs text-zinc-500 mb-1">Strands</span>
                        <span className="block text-2xl font-semibold text-white">{strands.length}</span>
                    </div>
                    <div className="bg-black p-4 border border-zinc-900 rounded-md">
                        <span className="block text-xs text-zinc-500 mb-1">Inbox</span>
                        <span className="block text-2xl font-semibold text-white">{sharedWithMe.length}</span>
                    </div>
                    <div className="bg-black p-4 border border-zinc-900 rounded-md">
                        <span className="block text-xs text-zinc-500 mb-1">Encryption</span>
                        <span className={`text-sm font-semibold flex items-center gap-1.5 ${hasE2EKeys ? 'text-green-400' : 'text-zinc-600'}`}>
                            <FiLock size={14} />
                            {hasE2EKeys ? 'E2E Active' : 'Not Set Up'}
                        </span>
                    </div>
                </div>

                {/* ===== INBOX ===== */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                        <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                            <FiInbox size={14} /> Inbox
                            {(sharedWithMe.length + coSignRequests.filter(r => r.status === 'pending').length) > 0 && (
                                <span className="px-1.5 py-0.5 bg-blue-950 text-blue-400 text-[10px] rounded-full font-medium">
                                    {sharedWithMe.length + coSignRequests.filter(r => r.status === 'pending').length}
                                </span>
                            )}
                        </h3>
                    </div>
                    {sharedWithMe.length === 0 && coSignRequests.filter(r => r.status === 'pending').length === 0 ? (
                        <div className="py-10 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-md text-center">
                            <FiInbox className="text-zinc-700 text-2xl mb-3" />
                            <p className="text-sm text-zinc-500">No documents received yet</p>
                            <p className="text-xs text-zinc-600 mt-1">Documents shared with you, co-sign requests, or witness requests will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Co-sign requests (pending) */}
                            {coSignRequests.filter(r => r.status === 'pending').map((req) => (
                                <div key={`cosign-${req.id}`} className="border border-amber-900/40 rounded-md bg-black p-4 flex items-center gap-4">
                                    <div className="text-amber-500 shrink-0">
                                        <FiEdit3 size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">
                                                {req.document_name}
                                            </span>
                                            <span className="px-1.5 py-0.5 bg-amber-950 text-amber-400 text-[10px] rounded shrink-0">
                                                Co-Sign Request
                                            </span>
                                        </div>
                                        <span className="text-xs text-zinc-600">
                                            From ${req.sender_handle} &middot; {new Date(req.created_at).toLocaleDateString()}
                                        </span>
                                        {req.message && (
                                            <p className="text-xs text-zinc-500 mt-1 truncate">&ldquo;{req.message}&rdquo;</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => openCoSign({ id: req.id, document_id: req.document_id, document_type: 'vault_item', grantor_handle: req.sender_handle, wrapped_key: '', ephemeral_public_key: '', created_at: req.created_at, signature_type: 'SEALED_DOCUMENT', metadata: { originalFileName: req.document_name } })}
                                        className="px-3 py-1.5 bg-amber-600/20 text-amber-400 text-xs rounded flex items-center gap-1.5 hover:bg-amber-600/30 transition-colors shrink-0"
                                    >
                                        <FiEdit3 size={12} /> Co-Sign
                                    </button>
                                </div>
                            ))}

                            {/* Shared documents */}
                            {sharedWithMe.map((doc) => {
                                const isSealed = doc.signature_type === 'SEALED_DOCUMENT' || doc.document_type === 'SEALED_DOCUMENT';
                                const isWitnessRequest = doc.signature_type === 'WITNESS_REQUEST' || doc.document_type === 'WITNESS_REQUEST';
                                return (
                                    <div key={doc.id} className={`border rounded-md bg-black p-4 flex items-center gap-4 ${isWitnessRequest ? 'border-blue-900/40' : isSealed ? 'border-amber-900/40' : 'border-zinc-900'}`}>
                                        <div className="text-zinc-500 shrink-0">
                                            {isWitnessRequest ? (
                                                <FiEye size={18} className="text-blue-400" />
                                            ) : isSealed ? (
                                                <FiShield size={18} className="text-amber-500" />
                                            ) : (
                                                <FiShare2 size={18} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white truncate">
                                                    {doc.metadata?.originalFileName || doc.metadata?.fileName || doc.metadata?.type || doc.document_type}
                                                </span>
                                                {isWitnessRequest && (
                                                    <span className="px-1.5 py-0.5 bg-blue-950 text-blue-400 text-[10px] rounded shrink-0">
                                                        Witness
                                                    </span>
                                                )}
                                                {isSealed && !isWitnessRequest && (
                                                    <span className="px-1.5 py-0.5 bg-amber-950 text-amber-400 text-[10px] rounded shrink-0">
                                                        Sign
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-zinc-600">
                                                From ${doc.grantor_handle} &middot; {new Date(doc.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {(isSealed || isWitnessRequest) && (
                                            <button
                                                onClick={() => openCoSign(doc)}
                                                className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors shrink-0 ${
                                                    isWitnessRequest
                                                        ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                                        : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                                                }`}
                                            >
                                                {isWitnessRequest ? (
                                                    <><FiEye size={12} /> Witness</>
                                                ) : (
                                                    <><FiEdit3 size={12} /> Co-Sign</>
                                                )}
                                            </button>
                                        )}
                                        <span className="px-2 py-1 bg-blue-950/30 text-blue-400 text-xs rounded shrink-0">
                                            E2E Encrypted
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ===== SENT CO-SIGN REQUESTS ===== */}
                {sentCoSignRequests.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <FiSend size={14} /> Sent Co-Sign Requests
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {sentCoSignRequests.map((req) => (
                                <div key={req.id} className={`border rounded-md bg-black p-4 flex items-center gap-4 ${req.status === 'signed' ? 'border-green-900/40' : 'border-zinc-900'}`}>
                                    <div className="shrink-0">
                                        {req.status === 'signed' ? (
                                            <FiCheck size={18} className="text-green-400" />
                                        ) : (
                                            <FiLoader size={18} className="text-zinc-500 animate-spin-slow" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">
                                                {req.document_name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-zinc-600">
                                            To ${req.recipient_handle || req.recipient_email || 'unknown'} &middot; {new Date(req.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded shrink-0 ${
                                        req.status === 'signed'
                                            ? 'bg-green-950/30 text-green-400'
                                            : 'bg-zinc-900 text-zinc-500'
                                    }`}>
                                        {req.status === 'signed' ? 'Co-Signed' : 'Pending'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== TWO-PANEL SIGNING WORKSPACE ===== */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                        <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Signing Workspace
                        </h3>
                    </div>

                    {signatures.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-md text-center">
                            <FiEdit3 className="text-zinc-700 text-3xl mb-4" />
                            <p className="text-base text-zinc-400 font-medium">No vault items yet</p>
                            <p className="text-sm text-zinc-600 mt-1">Create your first signature or upload a document.</p>
                        </div>
                    ) : (
                        <div className="grid lg:grid-cols-12 gap-4 min-h-[500px]">
                            {/* LEFT PANEL — Signatures & Media */}
                            <div className="lg:col-span-3 border border-zinc-900 rounded-md bg-zinc-950/50 p-3 overflow-hidden flex flex-col">
                                <SignatureExplorer
                                    signatures={signaturesOnly}
                                    media={mediaItems}
                                    registeredSignatureId={registeredSignatureId}
                                    onDragStart={() => {}}
                                />
                            </div>

                            {/* RIGHT PANEL — Documents / Canvas */}
                            <div className="lg:col-span-9 border border-zinc-900 rounded-md bg-zinc-950/50 overflow-hidden flex flex-col">
                                {selectedDocBlobUrl && selectedDocumentId ? (
                                    <DocumentCanvas
                                        documentUrl={selectedDocBlobUrl}
                                        documentId={selectedDocumentId}
                                        signerHandle={handle || undefined}
                                        originalFileName={signatures.find(s => s.id === selectedDocumentId)?.metadata?.fileName || signatures.find(s => s.id === selectedDocumentId)?.metadata?.originalFileName}
                                        elements={placedElements}
                                        onElementsChange={setPlacedElements}
                                        onSeal={handleSeal}
                                        onClose={closeDocumentCanvas}
                                    />
                                ) : (
                                    <div className="flex flex-col h-full">
                                        <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
                                            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                                <FiFileText size={12} /> Documents ({documents.length})
                                            </h4>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {documents.length === 0 ? (
                                                <div className="py-16 flex flex-col items-center justify-center text-center">
                                                    <FiFileText className="text-zinc-700 text-2xl mb-3" />
                                                    <p className="text-sm text-zinc-500">No documents uploaded yet</p>
                                                    <p className="text-xs text-zinc-600 mt-1">Upload a document using the button above</p>
                                                </div>
                                            ) : (
                                                documents.map((sig) => {
                                                    const isOnChain = sig.txid && !sig.txid.startsWith('pending-');
                                                    const isExpanded = expandedSig === sig.id;
                                                    const isSigned = sig.wallet_signed;
                                                    const isSealed = sig.signature_type === 'SEALED_DOCUMENT';
                                                    return (
                                                        <div key={sig.id} className={`border rounded-md overflow-hidden ${isSealed ? 'border-amber-900/40' : 'border-zinc-800'}`}>
                                                            <button
                                                                onClick={() => previewSignature(sig)}
                                                                className="w-full text-left bg-black hover:bg-zinc-950 transition-colors p-3 flex items-center gap-3"
                                                            >
                                                                <div className="text-zinc-500 shrink-0">
                                                                    {isSealed ? <FiShield size={16} className="text-amber-500" /> : <FiFileText size={16} />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium text-white truncate">
                                                                            {sig.metadata?.originalFileName || sig.metadata?.fileName || sig.metadata?.type || sig.signature_type}
                                                                        </span>
                                                                        {isSealed && (
                                                                            <span className="px-1.5 py-0.5 bg-amber-950 text-amber-400 text-[10px] rounded shrink-0 flex items-center gap-1">
                                                                                <FiShield size={10} /> Sealed
                                                                            </span>
                                                                        )}
                                                                        {isOnChain && isSealed && (
                                                                            <span className="px-1.5 py-0.5 bg-green-950 text-green-400 text-[10px] rounded shrink-0 flex items-center gap-1">
                                                                                <FiCheck size={10} /> On Chain
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                                                                        <span>{new Date(sig.created_at).toLocaleDateString()} at {new Date(sig.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        {isOnChain && (
                                                                            <span className="flex items-center gap-1">
                                                                                &middot;
                                                                                <span className="font-mono text-zinc-500">{sig.txid.slice(0, 8)}...{sig.txid.slice(-4)}</span>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); copyTxid(sig.txid); }}
                                                                                    className="text-zinc-600 hover:text-zinc-300 transition-colors"
                                                                                    title="Copy TXID"
                                                                                >
                                                                                    {copiedTxid === sig.txid ? <FiCheck size={10} className="text-green-400" /> : <FiCopy size={10} />}
                                                                                </button>
                                                                                <a
                                                                                    href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                                                    target="_blank"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    className="text-amber-600 hover:text-amber-400 transition-colors"
                                                                                    title="View on chain"
                                                                                >
                                                                                    <FiExternalLink size={10} />
                                                                                </a>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {sig.signature_type === 'DOCUMENT' && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openDocumentInCanvas(sig.id); }}
                                                                        className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded shrink-0 flex items-center gap-1 hover:bg-amber-600/30 transition-colors"
                                                                        title="Open in signing workspace"
                                                                    >
                                                                        <FiEdit3 size={10} /> Sign
                                                                    </button>
                                                                )}

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
                                                                    {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                                                </div>
                                                            </button>

                                                            {isExpanded && (
                                                                <div className="border-t border-zinc-900 bg-zinc-950 p-3 space-y-3">
                                                                    {previewLoading ? (
                                                                        <div className="flex items-center justify-center py-8">
                                                                            <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full opacity-20" />
                                                                        </div>
                                                                    ) : previewData?.type === 'svg' ? (
                                                                        <div className="bg-white rounded-md p-4 flex items-center justify-center">
                                                                            <img src={previewData.url} alt="Signature" className="max-h-40 w-auto" />
                                                                        </div>
                                                                    ) : previewData?.type === 'image' ? (
                                                                        <div className="bg-white rounded-md overflow-hidden">
                                                                            <img src={previewData.url} alt="Document" className="max-h-[300px] w-full object-contain" />
                                                                        </div>
                                                                    ) : previewData?.type === 'pdf' ? (
                                                                        <iframe src={previewData.url} className="w-full h-[400px] rounded-md border border-zinc-800" />
                                                                    ) : previewData?.type === 'video' ? (
                                                                        <video src={previewData.url} controls className="w-full max-h-[300px] rounded-md" />
                                                                    ) : previewData?.type === 'decrypt-failed' ? (
                                                                        <div className="text-center py-4 space-y-2">
                                                                            <FiLock className="mx-auto text-amber-500" size={20} />
                                                                            <p className="text-xs text-amber-400">Unable to decrypt</p>
                                                                        </div>
                                                                    ) : previewData?.type === 'no-data' ? (
                                                                        <div className="text-center py-4">
                                                                            <p className="text-xs text-zinc-500">No encrypted data stored</p>
                                                                        </div>
                                                                    ) : previewData?.type === 'no-key' ? (
                                                                        <div className="text-center py-4">
                                                                            <p className="text-xs text-zinc-500">Encryption key not available</p>
                                                                        </div>
                                                                    ) : previewData?.type === 'error' ? (
                                                                        <p className="text-xs text-red-400 text-center py-3">Failed to load preview</p>
                                                                    ) : previewData?.type === 'unsupported' ? (
                                                                        <p className="text-xs text-zinc-500 text-center py-3">Preview not available</p>
                                                                    ) : null}

                                                                    {/* Send options for sealed documents */}
                                                                    {isSealed && (
                                                                        <div className="flex items-center gap-2 flex-wrap pb-2 mb-2 border-b border-zinc-800">
                                                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider w-full">Send to recipient</span>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setCoSignModal({ documentId: sig.id, documentName: sig.metadata?.originalFileName || 'Sealed Document' }); }}
                                                                                className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiEdit3 size={12} /> Request Co-Sign
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: 'SEALED_DOCUMENT', itemLabel: sig.metadata?.originalFileName || 'Sealed Document' }); }}
                                                                                className="px-3 py-1.5 bg-amber-600 text-black text-xs font-medium rounded-md hover:bg-amber-500 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiMail size={12} /> Send via Email
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: 'SEALED_DOCUMENT_HC', itemLabel: sig.metadata?.originalFileName || 'Sealed Document' }); }}
                                                                                className="px-3 py-1.5 bg-green-600 text-black text-xs font-medium rounded-md hover:bg-green-500 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiUsers size={12} /> Send to HandCash
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: 'WITNESS_REQUEST', itemLabel: sig.metadata?.originalFileName || 'Sealed Document' }); }}
                                                                                className="px-3 py-1.5 bg-blue-600 text-black text-xs font-medium rounded-md hover:bg-blue-500 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiEye size={12} /> Request Witness
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        {sig.signature_type === 'DOCUMENT' && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); openDocumentInCanvas(sig.id); }}
                                                                                className="px-3 py-1.5 bg-amber-600 text-black text-xs font-medium rounded-md hover:bg-amber-500 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiEdit3 size={12} /> Open in Workspace
                                                                            </button>
                                                                        )}
                                                                        {!isSigned && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); attestSignature(sig.id); }}
                                                                                className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiShield size={12} /> Sign with HandCash
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: sig.signature_type, itemLabel: sig.metadata?.type || sig.signature_type }); }}
                                                                            className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                                        >
                                                                            <FiShare2 size={12} /> Share
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); downloadSignature(sig.id, sig); }}
                                                                            className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                                        >
                                                                            <FiDownload size={12} /> Download
                                                                        </button>
                                                                        {isOnChain && (
                                                                            <a
                                                                                href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                                                target="_blank"
                                                                                className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                                            >
                                                                                <FiExternalLink size={12} /> Chain
                                                                            </a>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); deleteSignature(sig.id); }}
                                                                            className="px-3 py-1.5 border border-red-900/30 bg-black text-red-900 text-xs rounded-md hover:text-red-400 hover:border-red-800 transition-all flex items-center gap-2 ml-auto"
                                                                        >
                                                                            <FiX size={12} /> Delete
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Non-document vault items (signatures & media with actions) */}
                {(signaturesOnly.length > 0 || mediaItems.length > 0) && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <FiShield size={14} /> Signature & Media Vault
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {[...signaturesOnly, ...mediaItems].map((sig) => {
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
                                                        <img src={previewData.url} alt="Photo" className="max-h-[400px] w-full object-contain" />
                                                    </div>
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
                                                            className="px-3 py-2 border border-zinc-700 bg-zinc-900 text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                        >
                                                            <FiShield size={14} /> Sign with HandCash
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: sig.signature_type, itemLabel: sig.metadata?.type || sig.signature_type }); }}
                                                        className="px-3 py-2 border border-zinc-700 bg-zinc-900 text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                    >
                                                        <FiShare2 size={14} /> Share
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); downloadSignature(sig.id, sig); }}
                                                        className="px-3 py-2 border border-zinc-700 bg-zinc-900 text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                                    >
                                                        <FiDownload size={14} /> Download
                                                    </button>
                                                    {isOnChain && (
                                                        <a
                                                            href={`https://whatsonchain.com/tx/${sig.txid}`}
                                                            target="_blank"
                                                            className="px-3 py-2 border border-zinc-700 bg-zinc-900 text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
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
                            })}
                        </div>
                    </div>
                )}

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

                {phoneCaptureMode && (
                    <PhoneCaptureModal
                        mode={phoneCaptureMode}
                        onCapture={(blob) => {
                            const mode = phoneCaptureMode;
                            setPhoneCaptureMode(null);
                            handleMediaCapture(blob, mode);
                        }}
                        onCancel={() => setPhoneCaptureMode(null)}
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

                {coSignModal && (
                    <CoSignRequestModal
                        documentName={coSignModal.documentName}
                        onSubmit={submitCoSignRequest}
                        onClose={() => setCoSignModal(null)}
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

// Inline modal for co-sign requests
function CoSignRequestModal({ documentName, onSubmit, onClose }: {
    documentName: string;
    onSubmit: (handle: string, email: string, message: string) => Promise<any>;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<'handle' | 'email'>('handle');
    const [handle, setHandle] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        setSending(true);
        setError(null);
        try {
            const result = await onSubmit(
                tab === 'handle' ? handle.replace(/^\$/, '') : '',
                tab === 'email' ? email : '',
                message
            );
            setSuccess(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to send request');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-md p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiEdit3 size={18} /> Request Co-Sign
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <FiX size={18} />
                    </button>
                </div>

                <p className="text-xs text-zinc-500">
                    Request a co-signature on <span className="text-white font-medium">&ldquo;{documentName}&rdquo;</span>
                </p>

                {success ? (
                    <div className="text-center py-8 space-y-3">
                        <div className="w-12 h-12 bg-green-950/30 border border-green-800 rounded-full flex items-center justify-center mx-auto">
                            <FiCheck className="text-green-400" size={20} />
                        </div>
                        <p className="text-sm text-green-400 font-medium">Co-sign request sent!</p>
                        <p className="text-xs text-zinc-500">They&apos;ll be notified and can co-sign from their inbox.</p>
                        <button onClick={onClose} className="mt-4 px-5 py-2 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-md hover:bg-zinc-800 transition-all">
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Tab toggle */}
                        <div className="flex bg-black border border-zinc-800 rounded-md p-0.5">
                            <button
                                onClick={() => { setTab('handle'); setError(null); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-[5px] transition-all flex items-center justify-center gap-1.5 ${tab === 'handle' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <FiUsers size={13} /> Handle
                            </button>
                            <button
                                onClick={() => { setTab('email'); setError(null); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-[5px] transition-all flex items-center justify-center gap-1.5 ${tab === 'email' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <FiMail size={13} /> Email
                            </button>
                        </div>

                        {tab === 'handle' ? (
                            <div className="space-y-2">
                                <label className="block text-xs text-zinc-400">Recipient HandCash Handle</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                                    <input
                                        type="text"
                                        value={handle}
                                        onChange={(e) => setHandle(e.target.value)}
                                        placeholder="handle"
                                        className="w-full pl-7 pr-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-xs text-zinc-400">Recipient Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="alice@example.com"
                                    className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-xs text-zinc-400">Message <span className="text-zinc-600">(optional)</span></label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Please co-sign this document..."
                                rows={2}
                                className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-md text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors resize-none"
                            />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 text-red-400 text-xs">
                                <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-800 bg-black text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-600 transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={sending || (tab === 'handle' ? !handle.trim() : !email.trim())}
                                className="flex-1 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? (
                                    <><FiLoader className="animate-spin" size={14} /> Sending...</>
                                ) : (
                                    <><FiSend size={14} /> Send Request</>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
