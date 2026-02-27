'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { bufferToBase64 } from '@/lib/attestation';
import SovereignSignature from '@/components/SovereignSignature';
import MediaCapture from '@/components/MediaCapture';
import PhoneCaptureModal from '@/components/PhoneCaptureModal';
import E2ESetupBanner from '@/components/E2ESetupBanner';
import { setupE2EKeys } from '@/lib/e2e-setup';
import { ToastProvider, useToast } from '@/components/Toast';
import ShareModal from '@/components/ShareModal';
import SignatureExplorer from '@/components/SignatureExplorer';
import DocumentCanvas from '@/components/DocumentCanvas';
import VideoCall from '@/components/VideoCall';
import type { PlacedElement } from '@/components/DocumentCanvas';
import { pdfToImage, type PdfImageResult } from '@/lib/pdf-to-image';
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
    FiBookOpen,
    FiPlus,
    FiCreditCard,
    FiHome,
    FiUserCheck,
    FiRotateCcw,
    FiTrash2,
    FiVideo,
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
    deleted_at?: string | null;
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
    request_type?: string;
    created_at: string;
    signed_at?: string;
    document_name: string;
    document_txid?: string;
    claim_token?: string;
}

export default function AccountPage() {
    return (
        <ToastProvider>
            <AccountPageInner />
        </ToastProvider>
    );
}

function AccountPageInner() {
    const { addToast } = useToast();
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
    const [vaultTab, setVaultTab] = useState('all');
    const [previewData, setPreviewData] = useState<{ url: string; type: string } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewRotation, setPreviewRotation] = useState(0);
    const [registeredSignatureId, setRegisteredSignatureId] = useState<string | null>(null);
    const [hasE2EKeys, setHasE2EKeys] = useState<boolean | null>(null);
    const [shareModal, setShareModal] = useState<{ documentId: string; documentType: string; itemType?: string; itemLabel?: string } | null>(null);
    const [sharedWithMe, setSharedWithMe] = useState<SharedDocument[]>([]);
    const [registeredSignatureSvg, setRegisteredSignatureSvg] = useState<string | null>(null);
    const [strands, setStrands] = useState<Strand[]>([]);
    const [coSignRequests, setCoSignRequests] = useState<CoSignRequest[]>([]);
    const [sentCoSignRequests, setSentCoSignRequests] = useState<CoSignRequest[]>([]);
    const [coSignModal, setCoSignModal] = useState<{ documentId: string; documentName: string; requestType?: 'co-sign' | 'witness' } | null>(null);
    const [copiedTxid, setCopiedTxid] = useState<string | null>(null);
    const [fullscreenPreview, setFullscreenPreview] = useState<string | null>(null);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ id: string; name: string; isSealed: boolean } | null>(null);
    const [trashItems, setTrashItems] = useState<Signature[]>([]);
    const [e2eAutoSetupStatus, setE2eAutoSetupStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
    const [videoCallToken, setVideoCallToken] = useState<{ token: string; documentName: string } | null>(null);

    // Self-attestation form state
    const [selfAttestOpen, setSelfAttestOpen] = useState(false);
    const [selfAttestForm, setSelfAttestForm] = useState({ fullName: '', addressLine1: '', addressLine2: '', city: '', postcode: '', country: '' });
    const [selfAttestAgreed, setSelfAttestAgreed] = useState(false);
    const [selfAttestSubmitting, setSelfAttestSubmitting] = useState(false);
    const [selfAttestError, setSelfAttestError] = useState<string | null>(null);

    // IP Thread (Bit Trust) state
    const [ipThreads, setIpThreads] = useState<{ id: string; strand_txid?: string; label?: string; metadata?: any; created_at: string; signature_id?: string }[]>([]);
    const [ipThreadModal, setIpThreadModal] = useState<{ documentId: string; documentName: string } | null>(null);
    const [ipThreadTitle, setIpThreadTitle] = useState('');
    const [ipThreadDescription, setIpThreadDescription] = useState('');
    const [ipThreadSubmitting, setIpThreadSubmitting] = useState(false);

    // ID Document upload state
    const [idDocUploadKey, setIdDocUploadKey] = useState(0);
    const [idDocType, setIdDocType] = useState<'passport' | 'utility_bill' | null>(null);

    // Peer Attestation state
    const [peerAttestModal, setPeerAttestModal] = useState(false);
    const [peerAttestHandle, setPeerAttestHandle] = useState('');
    const [peerAttestMessage, setPeerAttestMessage] = useState('');
    const [peerAttestSubmitting, setPeerAttestSubmitting] = useState(false);
    const [peerAttestRequests, setPeerAttestRequests] = useState<any[]>([]);
    const [peerAttestRespondModal, setPeerAttestRespondModal] = useState<any | null>(null);
    const [peerAttestRespondSubmitting, setPeerAttestRespondSubmitting] = useState(false);

    // Workspace state
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [selectedDocBlobUrl, setSelectedDocBlobUrl] = useState<string | null>(null);
    const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);
    const [docPageCount, setDocPageCount] = useState(1);
    const vaultRef = useRef<HTMLDivElement>(null);

    // Close fullscreen preview on Esc
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && fullscreenPreview) setFullscreenPreview(null);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [fullscreenPreview]);

    // Split vault items into categories
    const signaturesOnly = useMemo(() =>
        signatures.filter(s => s.signature_type === 'TLDRAW'),
        [signatures]
    );
    const mediaItems = useMemo(() =>
        signatures.filter(s => s.signature_type === 'CAMERA' || s.signature_type === 'VIDEO'),
        [signatures]
    );
    const sealedItems = useMemo(() =>
        signatures.filter(s => s.signature_type === 'SEALED_DOCUMENT'),
        [signatures]
    );
    const documents = useMemo(() => {
        // Unsealed documents only — exclude sealed docs and originals that have been sealed
        const sealedOriginalIds = new Set(
            signatures
                .filter(s => s.signature_type === 'SEALED_DOCUMENT' && s.metadata?.originalDocumentId)
                .map(s => s.metadata.originalDocumentId)
        );
        return signatures.filter(s =>
            s.signature_type === 'DOCUMENT' && !sealedOriginalIds.has(s.id)
        );
    }, [signatures]);

    // Sent items: sealed documents that have been shared, co-sign requested, or manually marked
    const sentItems = useMemo(() => {
        const sentDocIds = new Set(sentCoSignRequests.map(r => r.document_id));
        return sealedItems.filter(s => sentDocIds.has(s.id) || s.metadata?.sent);
    }, [sealedItems, sentCoSignRequests]);

    // Signed & Returned: co-sign requests we sent that came back signed
    const signedReturnedItems = useMemo(() =>
        sentCoSignRequests.filter(r => r.status === 'signed' && r.response_document_id),
        [sentCoSignRequests]
    );

    // Deduplicated shared items for inbox: exclude docs that already appear as co-sign requests
    const dedupedSharedWithMe = useMemo(() => {
        const coSignDocIds = new Set(coSignRequests.map(r => r.document_id));
        return sharedWithMe.filter(doc => !coSignDocIds.has(doc.document_id));
    }, [sharedWithMe, coSignRequests]);

    // All received documents: merge co-sign requests and shared-with-me (dedup by document_id)
    const allReceivedDocs = useMemo(() => {
        const docMap = new Map<string, SharedDocument>();
        // Add shared-with-me items first
        for (const doc of sharedWithMe) {
            docMap.set(doc.document_id, doc);
        }
        // Add co-sign request docs that aren't already in shared-with-me
        for (const req of coSignRequests) {
            if (!docMap.has(req.document_id)) {
                docMap.set(req.document_id, {
                    id: req.id,
                    document_id: req.document_id,
                    document_type: 'vault_item',
                    grantor_handle: req.sender_handle,
                    wrapped_key: '',
                    ephemeral_public_key: '',
                    created_at: req.created_at,
                    signature_type: 'SEALED_DOCUMENT',
                    metadata: { originalFileName: req.document_name },
                });
            }
        }
        return Array.from(docMap.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [sharedWithMe, coSignRequests]);

    // Pending co-sign document IDs (for showing co-sign button in received tab)
    const pendingCoSignDocIds = useMemo(() =>
        new Set(coSignRequests.filter(r => r.status === 'pending').map(r => r.document_id)),
        [coSignRequests]
    );

    const filteredVaultItems = useMemo(() => {
        if (vaultTab === 'documents') return documents;
        if (vaultTab === 'sealed') return sealedItems;
        if (vaultTab === 'sent') return sentItems;
        if (vaultTab === 'signatures') return signaturesOnly;
        if (vaultTab === 'media') return mediaItems;
        return signatures;
    }, [vaultTab, signatures, documents, sealedItems, sentItems, signaturesOnly, mediaItems]);

    // Resolve the real document name — walk up the seal chain client-side
    const resolveDocName = (sig: Signature): string => {
        const name = sig.metadata?.originalFileName || sig.metadata?.fileName;
        if (name && name !== 'Sealed Document') return name;
        // Try to walk up the chain via local signatures
        if (sig.signature_type === 'SEALED_DOCUMENT' && sig.metadata?.originalDocumentId) {
            let walkId = sig.metadata.originalDocumentId;
            let depth = 0;
            while (walkId && depth < 5) {
                const parent = signatures.find(s => s.id === walkId);
                if (!parent) break;
                const parentName = parent.metadata?.originalFileName || parent.metadata?.fileName;
                if (parentName && parentName !== 'Sealed Document') return parentName;
                walkId = parent.metadata?.originalDocumentId;
                depth++;
            }
        }
        return sig.metadata?.type !== 'Sealed Document' ? (sig.metadata?.type || sig.signature_type) : sig.signature_type;
    };

    const getStrengthLabel = (score: number) => {
        const strandTypes = strands.map(s => s.strand_subtype ? `${s.strand_type}/${s.strand_subtype}` : s.strand_type);
        const hasKyc = strandTypes.includes('kyc/veriff');
        const hasPeerAttestation = strandTypes.some(t => t.startsWith('peer_attestation/'));
        const hasIdDocs = strandTypes.some(t =>
            t.startsWith('id_document/') || t === 'CAMERA' || t === 'VIDEO'
        );
        const hasPaidSigning = strandTypes.includes('paid_signing');
        const hasSelfAttestation = strandTypes.includes('self_attestation');

        if (hasKyc) return { level: 4, label: 'Sovereign', color: 'text-amber-400' };
        if (hasPaidSigning || hasPeerAttestation) return { level: 3, label: 'Strong', color: 'text-green-400' };
        if (hasIdDocs || hasSelfAttestation) return { level: 2, label: 'Verified', color: 'text-blue-400' };
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
            addToast('Item sealed with HandCash wallet.', 'success');
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
            fetchPeerAttestRequests();
            fetchRegisteredSignatureSvg();
            fetchIpThreads();
            fetchTrash();
            // Auto-purge expired trash (fire and forget)
            fetch('/api/bitsign/trash-purge', { method: 'POST' }).catch(() => {});
        } else {
            setLoading(false);
        }
    }, []);

    const checkE2EKeys = async () => {
        try {
            const res = await fetch('/api/bitsign/keypair');
            if (!res.ok) { setHasE2EKeys(false); autoSetupE2E(); return; }
            const data = await res.json();
            const hasKeys = !!data.public_key;
            setHasE2EKeys(hasKeys);
            if (!hasKeys) autoSetupE2E();
        } catch {
            setHasE2EKeys(false);
            autoSetupE2E();
        }
    };

    const autoSetupE2E = async () => {
        setE2eAutoSetupStatus('running');
        try {
            await setupE2EKeys();
            setHasE2EKeys(true);
            setE2eAutoSetupStatus('done');
        } catch (err) {
            console.error('Auto E2E setup failed:', err);
            setE2eAutoSetupStatus('failed');
            // Banner will show as fallback
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

    const fetchPeerAttestRequests = async () => {
        try {
            const res = await fetch('/api/bitsign/peer-attest');
            if (!res.ok) return;
            const data = await res.json();
            setPeerAttestRequests(data.requests || []);
        } catch {
            // Not critical
        }
    };

    const fetchTrash = async () => {
        if (!handle) return;
        try {
            const res = await fetch(`/api/bitsign/signatures?handle=${handle}&trash=true`);
            if (!res.ok) return;
            const data = await res.json();
            setTrashItems(data.signatures || []);
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
        const isWitness = coSignModal.requestType === 'witness';
        try {
            const res = await fetch('/api/bitsign/co-sign-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: coSignModal.documentId,
                    recipientHandle: recipientHandle || undefined,
                    recipientEmail: recipientEmail || undefined,
                    message: message || undefined,
                    requestType: isWitness ? 'witness' : 'co-sign',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed to send ${isWitness ? 'witness' : 'co-sign'} request`);
            setCoSignModal(null);
            fetchSentCoSignRequests();
            addToast(isWitness ? 'Witness request sent!' : 'Co-sign request sent!', 'success');
            return data;
        } catch (error: any) {
            throw error;
        }
    };

    // After co-signing a shared document, link it to the co-sign request and return to sender
    const handleCoSignResponse = async (sealedDocId: string, originalDocId: string): Promise<boolean> => {
        // Find matching co-sign request
        const matchingReq = coSignRequests.find(r => r.document_id === originalDocId && r.status === 'pending');
        if (!matchingReq) {
            console.warn('[handleCoSignResponse] No matching pending co-sign request for doc', originalDocId);
            return false;
        }

        try {
            const res = await fetch('/api/bitsign/co-sign-respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: matchingReq.id,
                    responseDocumentId: sealedDocId,
                }),
            });
            if (res.ok) {
                addToast(`Signed document returned to $${matchingReq.sender_handle}`, 'success');
                fetchCoSignRequests();
                return true;
            } else {
                const data = await res.json().catch(() => ({}));
                console.error('[handleCoSignResponse] Failed:', data.error);
                addToast(`Failed to return document: ${data.error || 'Unknown error'}`, 'warning');
                return false;
            }
        } catch (err) {
            console.error('[handleCoSignResponse] Error:', err);
            addToast('Failed to return signed document to sender. You can retry from the Received tab.', 'warning');
            return false;
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

    // Open document in the workspace canvas — auto-switch to signatures tab
    const openDocumentInCanvas = async (sigId: string) => {
        setVaultTab('signatures');
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/preview`);
            if (!res.ok) throw new Error('Failed to load document');
            const contentType = res.headers.get('content-type') || '';

            let blob: Blob;
            let numPages = 1;
            if (contentType.includes('pdf') || contentType === 'application/octet-stream') {
                const arrayBuffer = await res.arrayBuffer();
                // Check PDF magic bytes for octet-stream
                const header = new Uint8Array(arrayBuffer.slice(0, 5));
                const isPdf = contentType.includes('pdf') ||
                    (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46); // %PDF
                if (isPdf) {
                    try {
                        const result = await pdfToImage(arrayBuffer);
                        blob = result.blob;
                        numPages = result.numPages;
                    } catch (pdfErr) {
                        console.error('PDF to image conversion failed:', pdfErr);
                        blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                    }
                } else {
                    blob = new Blob([arrayBuffer], { type: contentType });
                }
            } else if (contentType.startsWith('image/')) {
                blob = await res.blob();
            } else if (contentType.includes('json')) {
                // Encrypted document — not yet supported in signing canvas
                alert('This document is encrypted. Encrypted documents cannot yet be opened in the signing workspace.');
                return;
            } else {
                console.warn('Unsupported content type for canvas:', contentType);
                alert(`This file type (${contentType}) cannot be opened in the signing workspace. Supported: PDF, PNG, JPEG.`);
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
            setDocPageCount(numPages);
            addToast('Document opened. Add signatures, text, or dates then seal.', 'info');
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
        setDocPageCount(1);
    };

    // Multi-element seal handler
    const handleSeal = async (compositeBase64: string, elements: PlacedElement[]) => {
        if (!handle || !selectedDocumentId) return;
        // Grab original doc metadata before closing canvas
        const originalDoc = signatures.find(s => s.id === selectedDocumentId);
        const originalFileName = originalDoc ? resolveDocName(originalDoc) : 'Document';
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
            if (!verifyRes.ok) {
                const text = await verifyRes.text();
                let msg = 'Wallet verification failed';
                try { msg = JSON.parse(text).error || msg; } catch {}
                throw new Error(msg);
            }
            const verifyData = await verifyRes.json();

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
            if (!sealRes.ok) {
                const text = await sealRes.text();
                let msg = 'Seal failed';
                try { msg = JSON.parse(text).error || msg; } catch {}
                if (sealRes.status === 413) msg = 'Document too large to seal. Try a smaller file.';
                throw new Error(msg);
            }
            const sealData = await sealRes.json();

            setSignatures(prev => [{
                id: sealData.id,
                signature_type: 'SEALED_DOCUMENT',
                txid: sealData.txid,
                created_at: new Date().toISOString(),
                metadata: { type: 'Sealed Document', mimeType: 'image/png', originalDocumentId: selectedDocumentId, originalFileName },
                wallet_signed: true,
                wallet_address: verifyData.walletAddress,
            }, ...prev]);

            // If this was a co-sign or witness request, return the signed document to sender
            const matchingRequest = coSignRequests.find(r => r.document_id === selectedDocumentId && r.status === 'pending');
            if (matchingRequest) {
                const isWitness = matchingRequest.request_type === 'witness';
                const returned = await handleCoSignResponse(sealData.id, selectedDocumentId!);
                if (!returned) {
                    addToast(`Document sealed but could not auto-return to sender. Use "Return to Sender" in the Received tab.`, 'warning');
                }
            } else {
                addToast('Document sealed! Download a copy for your records.', 'download');
            }
        } catch (error: any) {
            console.error('Seal failed:', error);
            alert(error?.message || 'Failed to seal document.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Preview a shared document in the viewer (read-only)
    const previewSharedDoc = async (doc: SharedDocument) => {
        setExpandedSig(doc.document_id);
        setPreviewLoading(true);
        setPreviewData(null);
        setPreviewRotation(0);

        try {
            const previewUrl = `/api/bitsign/signatures/${doc.document_id}/preview`;
            const res = await fetch(previewUrl);
            if (!res.ok) {
                setPreviewData({ url: '', type: 'error' });
                return;
            }
            const contentType = res.headers.get('content-type') || '';

            if (contentType.includes('svg')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'svg' });
            } else if (contentType.startsWith('image/')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'image' });
            } else if (contentType.includes('pdf')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'pdf' });
            } else if (contentType.startsWith('video/')) {
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'video' });
            } else {
                // Try as image for sealed documents (base64 image data)
                const blob = await res.blob();
                setPreviewData({ url: URL.createObjectURL(blob), type: 'image' });
            }
        } catch (error) {
            console.error('Shared doc preview failed:', error);
            setPreviewData({ url: '', type: 'error' });
        } finally {
            setPreviewLoading(false);
        }
    };

    // Co-sign handler for shared documents
    const openCoSign = async (doc: SharedDocument) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${doc.document_id}/preview`);
            if (!res.ok) throw new Error('Failed to load shared document');
            const contentType = res.headers.get('content-type') || '';

            let blob: Blob;
            let numPages = 1;
            if (contentType.includes('pdf') || contentType === 'application/octet-stream') {
                const arrayBuffer = await res.arrayBuffer();
                const header = new Uint8Array(arrayBuffer.slice(0, 5));
                const isPdf = contentType.includes('pdf') ||
                    (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46);
                if (isPdf) {
                    try {
                        const result = await pdfToImage(arrayBuffer);
                        blob = result.blob;
                        numPages = result.numPages;
                    } catch (pdfErr) {
                        console.error('PDF to image conversion failed:', pdfErr);
                        blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                    }
                } else {
                    blob = new Blob([arrayBuffer], { type: contentType });
                }
            } else if (contentType.startsWith('image/')) {
                blob = await res.blob();
            } else {
                alert(`This file type (${contentType}) cannot be co-signed in the workspace. Supported: PDF, PNG, JPEG.`);
                return;
            }

            const blobUrl = URL.createObjectURL(blob);
            if (selectedDocBlobUrl && selectedDocBlobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(selectedDocBlobUrl);
            }
            setSelectedDocumentId(doc.document_id);
            setSelectedDocBlobUrl(blobUrl);
            setPlacedElements([]);
            setDocPageCount(numPages);
            // Scroll vault into view so user sees the canvas
            setTimeout(() => vaultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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

    const submitSelfAttestation = async () => {
        if (!handle) return;
        setSelfAttestSubmitting(true);
        setSelfAttestError(null);
        try {
            const res = await fetch('/api/bitsign/self-attest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selfAttestForm),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit');
            // Refresh data to pick up new strand
            await fetchData(handle);
            setSelfAttestOpen(false);
            setSelfAttestForm({ fullName: '', addressLine1: '', addressLine2: '', city: '', postcode: '', country: '' });
            setSelfAttestAgreed(false);
        } catch (err: any) {
            setSelfAttestError(err.message);
        } finally {
            setSelfAttestSubmitting(false);
        }
    };

    const fetchIpThreads = async () => {
        try {
            const res = await fetch('/api/bitsign/ip-thread');
            if (!res.ok) return;
            const data = await res.json();
            setIpThreads(data.threads || []);
        } catch {
            // Not critical
        }
    };

    const submitIpThread = async () => {
        if (!ipThreadModal || !handle) return;
        setIpThreadSubmitting(true);
        try {
            const res = await fetch('/api/bitsign/ip-thread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: ipThreadModal.documentId,
                    title: ipThreadTitle,
                    description: ipThreadDescription,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to register IP thread');
            setIpThreadModal(null);
            setIpThreadTitle('');
            setIpThreadDescription('');
            await fetchIpThreads();
            await fetchData(handle);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIpThreadSubmitting(false);
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

    // Save a drawn signature from the DocumentCanvas modal to vault, return the signature ID
    const saveSignatureFromCanvas = async (signatureData: { svg: string; json: string }): Promise<string | null> => {
        if (!handle) return null;
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
            if (!response.ok) return null;

            const newSig = {
                id: data.signature?.id || data.txid,
                signature_type: 'TLDRAW',
                txid: data.txid,
                created_at: new Date().toISOString(),
                metadata: { type: 'Hand-written Signature' }
            };
            setSignatures(prev => [newSig, ...prev]);
            addToast('Signature saved to vault.', 'success');
            return newSig.id;
        } catch {
            return null;
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

            // Profile picture is now set explicitly by the user from attested photos only
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

    const handleIdDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'passport' | 'utility_bill') => {
        const file = e.target.files?.[0];
        if (!file || !handle) return;

        setIsProcessing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const base64 = bufferToBase64(arrayBuffer);

            // 1. Upload the document to vault
            const response = await fetch('/api/bitsign/inscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plaintextData: base64,
                    handle,
                    signatureType: 'DOCUMENT',
                    metadata: {
                        type: docType === 'passport' ? 'Passport' : 'Utility Bill',
                        fileName: file.name,
                        mimeType: file.type,
                        idDocumentType: docType,
                    }
                })
            });
            if (response.status === 413) throw new Error('File too large. Must be under 3MB.');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');

            const sigId = data.signature?.id || data.txid;

            setSignatures(prev => [{
                id: sigId,
                signature_type: 'DOCUMENT',
                txid: data.txid,
                created_at: new Date().toISOString(),
                metadata: { type: docType === 'passport' ? 'Passport' : 'Utility Bill', fileName: file.name, mimeType: file.type, idDocumentType: docType }
            }, ...prev]);

            // 2. Create the identity strand
            const strandRes = await fetch('/api/bitsign/id-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureId: sigId, documentType: docType })
            });
            const strandData = await strandRes.json();
            if (strandRes.ok && strandData.success) {
                setStrands(prev => [...prev, {
                    id: strandData.strandId,
                    strand_type: 'id_document',
                    strand_subtype: docType === 'passport' ? 'passport' : 'proof_of_address',
                    strand_txid: strandData.strandTxid,
                    label: docType === 'passport' ? 'Passport' : 'Proof of Address (Utility Bill)',
                    created_at: new Date().toISOString(),
                }]);
                alert(`${docType === 'passport' ? 'Passport' : 'Utility bill'} uploaded and identity strand created!`);
            } else {
                alert(strandData.error || 'Document uploaded but strand creation failed.');
            }
        } catch (error: any) {
            console.error('ID document upload failed:', error);
            alert(error?.message || 'Failed to upload. Please try again.');
        } finally {
            setIsProcessing(false);
            setIdDocUploadKey(k => k + 1);
        }
    };

    const requestPeerAttestation = async () => {
        if (!handle || !peerAttestHandle.trim()) return;
        setPeerAttestSubmitting(true);
        try {
            const res = await fetch('/api/bitsign/peer-attest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request',
                    peerHandle: peerAttestHandle.trim(),
                    message: peerAttestMessage.trim() || undefined,
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');

            alert(`Attestation request sent to ${peerAttestHandle.trim()}!`);
            setPeerAttestModal(false);
            setPeerAttestHandle('');
            setPeerAttestMessage('');
        } catch (error: any) {
            alert(error?.message || 'Failed to send attestation request.');
        } finally {
            setPeerAttestSubmitting(false);
        }
    };

    const respondPeerAttestation = async (requestId: string, declaration: string) => {
        setPeerAttestRespondSubmitting(true);
        try {
            const res = await fetch('/api/bitsign/peer-attest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'respond', requestId, declaration })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');

            alert('Attestation signed and submitted!');
            setPeerAttestRespondModal(null);
            setPeerAttestRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'attested' } : r));
        } catch (error: any) {
            alert(error?.message || 'Failed to submit attestation.');
        } finally {
            setPeerAttestRespondSubmitting(false);
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

    const setAsProfilePicture = async (sigId: string) => {
        try {
            const res = await fetch('/api/bitsign/profile-picture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureId: sigId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            if (data.avatarUrl && identity) {
                setIdentity({ ...identity, avatar_url: data.avatarUrl });
            }
            alert('Profile picture updated!');
        } catch (error: any) {
            alert(error?.message || 'Failed to set profile picture.');
        }
    };

    const unsealDocument = async (sigId: string) => {
        if (!confirm('Unseal this document? It will be opened in the signing workspace so you can add more signatures or elements.')) return;
        // Open the sealed composite as a new editable document
        await openDocumentInCanvas(sigId);
        addToast('Document unsealed. Add your signatures then re-seal.', 'info');
    };

    const deleteSignature = async (sigId: string) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/delete`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Delete failed');
            }
            // Move to trash locally
            const deleted = signatures.find(s => s.id === sigId);
            setSignatures(prev => prev.filter(s => s.id !== sigId));
            if (deleted) {
                setTrashItems(prev => [{ ...deleted, deleted_at: new Date().toISOString() }, ...prev]);
            }
            if (expandedSig === sigId) {
                setExpandedSig(null);
                setPreviewData(null);
            }
            addToast('Moved to trash', 'info');
        } catch (error) {
            console.error('Delete failed:', error);
            addToast('Failed to delete. Please try again.', 'warning');
        }
    };

    const restoreFromTrash = async (sigId: string) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/delete`, { method: 'PATCH' });
            if (!res.ok) throw new Error('Restore failed');
            const restored = trashItems.find(s => s.id === sigId);
            setTrashItems(prev => prev.filter(s => s.id !== sigId));
            if (restored) {
                setSignatures(prev => [{ ...restored, deleted_at: null }, ...prev]);
            }
            addToast('Restored from trash', 'success');
        } catch {
            addToast('Failed to restore', 'warning');
        }
    };

    const permanentDelete = async (sigId: string) => {
        if (!confirm('Permanently delete this item? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/delete?permanent=true`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setTrashItems(prev => prev.filter(s => s.id !== sigId));
            addToast('Permanently deleted', 'info');
        } catch {
            addToast('Failed to delete permanently', 'warning');
        }
    };

    const emptyTrash = async () => {
        if (!confirm(`Permanently delete all ${trashItems.length} items in trash? This cannot be undone.`)) return;
        let deleted = 0;
        for (const item of trashItems) {
            try {
                const res = await fetch(`/api/bitsign/signatures/${item.id}/delete?permanent=true`, { method: 'DELETE' });
                if (res.ok) deleted++;
            } catch {}
        }
        setTrashItems([]);
        addToast(`Permanently deleted ${deleted} items`, 'info');
    };

    const confirmDelete = (sigId: string, sig?: Signature) => {
        const isSealed = sig?.signature_type === 'SEALED_DOCUMENT';
        const name = sig?.metadata?.originalFileName || sig?.metadata?.fileName || sig?.metadata?.type || sig?.signature_type || 'item';
        if (isSealed) {
            setDeleteConfirmModal({ id: sigId, name, isSealed: true });
        } else {
            setDeleteConfirmModal({ id: sigId, name, isSealed: false });
        }
    };

    const dismissCoSignRequest = async (reqId: string, type: 'sent' | 'received') => {
        try {
            const res = await fetch(`/api/bitsign/co-sign-request/dismiss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: reqId }),
            });
            if (!res.ok) throw new Error('Dismiss failed');
            if (type === 'sent') {
                setSentCoSignRequests(prev => prev.filter(r => r.id !== reqId));
            } else {
                setCoSignRequests(prev => prev.filter(r => r.id !== reqId));
            }
            addToast('Request dismissed', 'info');
        } catch {
            addToast('Failed to dismiss', 'warning');
        }
    };

    const dismissSharedDoc = (docId: string) => {
        setSharedWithMe(prev => prev.filter(d => d.id !== docId));
        addToast('Dismissed from inbox', 'info');
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
            addToast('Downloading...', 'download');
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download. Please try again.');
        }
    };

    const markAsSent = async (sigId: string) => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metadata: { sent: true, sent_at: new Date().toISOString() } }),
            });
            if (!res.ok) throw new Error('Failed to mark as sent');
            setSignatures(prev => prev.map(s =>
                s.id === sigId ? { ...s, metadata: { ...s.metadata, sent: true, sent_at: new Date().toISOString() } } : s
            ));
            addToast('Marked as sent.', 'success');
        } catch {
            alert('Failed to mark as sent.');
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
        setPreviewRotation(0);

        if (sig.signature_type === 'SEALED_DOCUMENT') {
            addToast('Viewing sealed document. Download a copy for your records.', 'download');
        }

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

                            <div className="flex items-center gap-2 flex-wrap">
                                    {[
                                        { id: 'github', label: 'GitHub', icon: FiGithub, active: true, linked: !!identity?.github_handle, handle: identity?.github_handle, authUrl: '/api/auth/github' },
                                        { id: 'google', label: 'Google', icon: FiMail, active: true, linked: !!identity?.google_email, handle: identity?.google_email, authUrl: '/api/auth/google' },
                                        { id: 'twitter', label: 'X', icon: FiTwitter, active: true, linked: !!identity?.twitter_handle, handle: identity?.twitter_handle ? `@${identity.twitter_handle}` : undefined, authUrl: '/api/auth/twitter' },
                                        { id: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, active: true, linked: !!identity?.linkedin_name, handle: identity?.linkedin_name, authUrl: '/api/auth/linkedin' },
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

                        {identity ? (
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
                                    {identity.token_id && identity.token_id !== 'pending' && (
                                        <a
                                            href={`https://whatsonchain.com/tx/${identity.token_id}`}
                                            target="_blank"
                                            className="p-2 bg-zinc-900 text-zinc-500 hover:text-white transition-colors rounded-md"
                                        >
                                            <FiExternalLink />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-950 border border-zinc-900 rounded-md">
                                <FiLoader className="animate-spin text-zinc-500" size={14} />
                                <span className="text-xs text-zinc-500">Setting up identity...</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* E2E Setup — auto-setup indicator or fallback banner */}
                {hasE2EKeys === false && e2eAutoSetupStatus === 'running' && (
                    <div className="flex items-center gap-3 px-4 py-3 border border-blue-900/30 bg-blue-950/10 rounded-md">
                        <FiLoader className="animate-spin text-blue-400" size={14} />
                        <span className="text-xs text-zinc-400">Setting up encryption...</span>
                    </div>
                )}
                {hasE2EKeys === false && e2eAutoSetupStatus === 'failed' && (
                    <E2ESetupBanner onSetupComplete={() => setHasE2EKeys(true)} />
                )}

                {/* Add to vault — prominent button grid */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Add to Vault</span>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>{signatures.length} items</span>
                            <span>{strands.length} strands</span>
                            <span className={`flex items-center gap-1 ${hasE2EKeys ? 'text-green-500' : 'text-zinc-600'}`}>
                                <FiLock size={11} /> {hasE2EKeys ? 'E2E' : 'No E2E'}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        <button
                            onClick={() => setIsSignatureModalOpen(true)}
                            className="flex flex-col items-center gap-1.5 px-3 py-3 border border-zinc-700 bg-zinc-800/60 rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-700/60 transition-all"
                        >
                            <FiEdit3 size={18} />
                            <span className="text-xs">Signature</span>
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowDeviceChoice(showDeviceChoice === 'PHOTO' ? null : 'PHOTO')}
                                className="w-full flex flex-col items-center gap-1.5 px-3 py-3 border border-zinc-700 bg-zinc-800/60 rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-700/60 transition-all"
                            >
                                <FiCamera size={18} />
                                <span className="text-xs">Photo</span>
                            </button>
                            {showDeviceChoice === 'PHOTO' && (
                                <div className="absolute top-full left-0 mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-md overflow-hidden shadow-xl min-w-[160px]">
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setCaptureMode('PHOTO'); }}
                                        className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <FiMonitor size={13} /> This device
                                    </button>
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setPhoneCaptureMode('PHOTO'); }}
                                        className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2 border-t border-zinc-800"
                                    >
                                        <FiSmartphone size={13} /> Phone camera
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowDeviceChoice(showDeviceChoice === 'VIDEO' ? null : 'VIDEO')}
                                className="w-full flex flex-col items-center gap-1.5 px-3 py-3 border border-zinc-700 bg-zinc-800/60 rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-700/60 transition-all"
                            >
                                <FiActivity size={18} />
                                <span className="text-xs">Video</span>
                            </button>
                            {showDeviceChoice === 'VIDEO' && (
                                <div className="absolute top-full left-0 mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-md overflow-hidden shadow-xl min-w-[160px]">
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setCaptureMode('VIDEO'); }}
                                        className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <FiMonitor size={13} /> This device
                                    </button>
                                    <button
                                        onClick={() => { setShowDeviceChoice(null); setPhoneCaptureMode('VIDEO'); }}
                                        className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2 border-t border-zinc-800"
                                    >
                                        <FiSmartphone size={13} /> Phone camera
                                    </button>
                                </div>
                            )}
                        </div>
                        <label className="flex flex-col items-center gap-1.5 px-3 py-3 border border-zinc-700 bg-zinc-800/60 rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-700/60 transition-all cursor-pointer relative">
                            <input key={uploadInputKey} type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => { handleDocumentUpload(e); setUploadInputKey(k => k + 1); }} />
                            <FiFileText size={18} />
                            <span className="text-xs">Document</span>
                        </label>
                        <label className={`flex flex-col items-center gap-1.5 px-3 py-3 border rounded-lg text-sm transition-all cursor-pointer relative ${
                            strands.some(s => s.strand_type === 'id_document' && s.strand_subtype === 'passport')
                                ? 'border-green-900/40 bg-green-950/20 text-green-400'
                                : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-700/60'
                        }`}>
                            <input key={`passport-${idDocUploadKey}`} type="file" accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleIdDocUpload(e, 'passport')} />
                            <FiCreditCard size={18} />
                            <span className="text-xs">Passport</span>
                            {strands.some(s => s.strand_type === 'id_document' && s.strand_subtype === 'passport') && (
                                <FiCheck size={10} className="absolute top-1 right-1 text-green-400" />
                            )}
                        </label>
                        <label className={`flex flex-col items-center gap-1.5 px-3 py-3 border rounded-lg text-sm transition-all cursor-pointer relative ${
                            strands.some(s => s.strand_type === 'id_document' && s.strand_subtype === 'proof_of_address')
                                ? 'border-green-900/40 bg-green-950/20 text-green-400'
                                : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-700/60'
                        }`}>
                            <input key={`utility-${idDocUploadKey}`} type="file" accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleIdDocUpload(e, 'utility_bill')} />
                            <FiHome size={18} />
                            <span className="text-xs">Utility Bill</span>
                            {strands.some(s => s.strand_type === 'id_document' && s.strand_subtype === 'proof_of_address') && (
                                <FiCheck size={10} className="absolute top-1 right-1 text-green-400" />
                            )}
                        </label>
                        <button
                            onClick={() => setPeerAttestModal(true)}
                            className={`flex flex-col items-center gap-1.5 px-3 py-3 border rounded-lg text-sm transition-all ${
                                strands.some(s => s.strand_type === 'peer_attestation')
                                    ? 'border-green-900/40 bg-green-950/20 text-green-400'
                                    : 'border-blue-900/40 bg-blue-950/20 text-blue-400 hover:text-blue-300 hover:border-blue-800/60 hover:bg-blue-950/30'
                            }`}
                        >
                            <FiUserCheck size={18} />
                            <span className="text-xs">Peer Attest</span>
                        </button>
                    </div>
                </div>

                {/* ===== INBOX ===== */}
                {(dedupedSharedWithMe.length + coSignRequests.filter(r => r.status === 'pending').length + peerAttestRequests.filter(r => r.status === 'pending').length) > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                        <FiInbox size={12} /> Inbox
                        <span className="px-1.5 py-0.5 bg-blue-950 text-blue-400 text-[10px] rounded-full font-medium">
                            {dedupedSharedWithMe.length + coSignRequests.filter(r => r.status === 'pending').length + peerAttestRequests.filter(r => r.status === 'pending').length}
                        </span>
                    </h3>
                    {dedupedSharedWithMe.length === 0 && coSignRequests.filter(r => r.status === 'pending').length === 0 && peerAttestRequests.filter(r => r.status === 'pending').length === 0 ? (
                        <></>

                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {/* Co-sign and witness requests (pending) */}
                            {coSignRequests.filter(r => r.status === 'pending').map((req) => {
                                const isWitReq = req.request_type === 'witness';
                                return (
                                    <div
                                        key={`cosign-${req.id}`}
                                        className={`w-full text-left border rounded-md bg-black p-4 flex items-center gap-4 hover:bg-zinc-950 transition-colors ${isWitReq ? 'border-blue-900/40 hover:border-blue-800/60' : 'border-amber-900/40 hover:border-amber-800/60'}`}
                                    >
                                        <div className={`shrink-0 ${isWitReq ? 'text-blue-400' : 'text-amber-500'}`}>
                                            {isWitReq ? <FiEye size={18} /> : <FiEdit3 size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white truncate">
                                                    {req.document_name}
                                                </span>
                                                <span className={`px-1.5 py-0.5 text-[10px] rounded shrink-0 ${isWitReq ? 'bg-blue-950 text-blue-400' : 'bg-amber-950 text-amber-400'}`}>
                                                    {isWitReq ? 'Witness Request' : 'Co-Sign Request'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-zinc-600">
                                                From ${req.sender_handle} &middot; {new Date(req.created_at).toLocaleDateString()}
                                            </span>
                                            {req.message && (
                                                <p className="text-xs text-zinc-500 mt-1 truncate">&ldquo;{req.message}&rdquo;</p>
                                            )}
                                        </div>
                                        {req.claim_token && (
                                            <button
                                                onClick={() => setVideoCallToken({ token: req.claim_token!, documentName: req.document_name })}
                                                className="px-2 py-1.5 text-xs rounded bg-blue-600/20 text-blue-400 border border-blue-900/40 hover:bg-blue-600/30 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                                title="Join live signing call"
                                            >
                                                <FiVideo size={11} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openCoSign({ id: req.id, document_id: req.document_id, document_type: 'vault_item', grantor_handle: req.sender_handle, wrapped_key: '', ephemeral_public_key: '', created_at: req.created_at, signature_type: 'SEALED_DOCUMENT', metadata: { originalFileName: req.document_name } })}
                                            className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 shrink-0 cursor-pointer ${isWitReq ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'}`}
                                        >
                                            {isWitReq ? <><FiEye size={12} /> Witness</> : <><FiEdit3 size={12} /> Co-Sign</>}
                                        </button>
                                        <button
                                            onClick={() => dismissCoSignRequest(req.id, 'received')}
                                            className="p-1 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                                            title="Dismiss"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Peer attestation requests */}
                            {peerAttestRequests.filter(r => r.status === 'pending').map((req) => (
                                <div key={`peer-${req.id}`} className="border border-green-900/40 rounded-md bg-black p-4 flex items-center gap-4">
                                    <div className="text-green-500 shrink-0">
                                        <FiUserCheck size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">
                                                Peer Attestation
                                            </span>
                                            <span className="px-1.5 py-0.5 bg-green-950 text-green-400 text-[10px] rounded shrink-0">
                                                Witness Request
                                            </span>
                                        </div>
                                        <span className="text-xs text-zinc-600">
                                            From ${req.requester_handle} &middot; {new Date(req.created_at).toLocaleDateString()}
                                        </span>
                                        {req.message && (
                                            <p className="text-xs text-zinc-500 mt-1 truncate">&ldquo;{req.message}&rdquo;</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setPeerAttestRespondModal(req)}
                                        className="px-3 py-1.5 bg-green-600/20 text-green-400 text-xs rounded flex items-center gap-1.5 hover:bg-green-600/30 transition-colors shrink-0"
                                    >
                                        <FiShield size={12} /> Attest
                                    </button>
                                </div>
                            ))}

                            {/* Shared documents */}
                            {dedupedSharedWithMe.map((doc) => {
                                const isSealed = doc.signature_type === 'SEALED_DOCUMENT' || doc.document_type === 'SEALED_DOCUMENT';
                                const isWitnessRequest = doc.signature_type === 'WITNESS_REQUEST' || doc.document_type === 'WITNESS_REQUEST';
                                // Is this a returned co-signed doc? (I'm the original sender, this is the response)
                                const isReturnedDoc = sentCoSignRequests.some(r => r.response_document_id === doc.document_id && r.status === 'signed');
                                // Does this doc have a pending co-sign request for me?
                                const hasPendingRequest = coSignRequests.some(r => r.document_id === doc.document_id && r.status === 'pending');
                                // Determine document name
                                const rawName = doc.metadata?.originalFileName || doc.metadata?.fileName;
                                const docName = (rawName && rawName !== 'Sealed Document') ? rawName : (doc.metadata?.type !== 'Sealed Document' ? doc.metadata?.type : null) || doc.signature_type || 'Document';
                                return (
                                    <div key={doc.id} className={`border rounded-md bg-black p-4 flex items-center gap-4 ${isReturnedDoc ? 'border-green-900/40' : isWitnessRequest ? 'border-blue-900/40' : isSealed ? 'border-amber-900/40' : 'border-zinc-900'}`}>
                                        <div className="text-zinc-500 shrink-0">
                                            {isReturnedDoc ? (
                                                <FiCheck size={18} className="text-green-400" />
                                            ) : isWitnessRequest ? (
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
                                                    {docName}
                                                </span>
                                                {isReturnedDoc ? (
                                                    <span className="px-1.5 py-0.5 bg-green-950 text-green-400 text-[10px] rounded shrink-0">
                                                        Returned
                                                    </span>
                                                ) : isWitnessRequest ? (
                                                    <span className="px-1.5 py-0.5 bg-blue-950 text-blue-400 text-[10px] rounded shrink-0">
                                                        Witness
                                                    </span>
                                                ) : isSealed && hasPendingRequest ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-950 text-amber-400 text-[10px] rounded shrink-0">
                                                        Sign
                                                    </span>
                                                ) : null}
                                            </div>
                                            <span className="text-xs text-zinc-600">
                                                From ${doc.grantor_handle} &middot; {new Date(doc.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {isReturnedDoc ? (
                                            <button
                                                onClick={async () => {
                                                    setVaultTab('returned');
                                                    setExpandedSig(doc.document_id);
                                                    setPreviewLoading(true);
                                                    setPreviewData(null);
                                                    try {
                                                        const res = await fetch(`/api/bitsign/signatures/${doc.document_id}/preview`);
                                                        if (!res.ok) throw new Error('Failed to load');
                                                        const blob = await res.blob();
                                                        const url = URL.createObjectURL(blob);
                                                        setPreviewData({ url, type: blob.type?.startsWith('image/') ? 'image' : (blob.type || 'image/png') });
                                                    } catch {
                                                        addToast('Failed to load document preview', 'warning');
                                                    } finally {
                                                        setPreviewLoading(false);
                                                    }
                                                    setTimeout(() => vaultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                                                }}
                                                className="px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors shrink-0 bg-green-600/20 text-green-400 hover:bg-green-600/30"
                                            >
                                                <FiEye size={12} /> View
                                            </button>
                                        ) : (isSealed || isWitnessRequest) && hasPendingRequest ? (
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
                                        ) : (
                                            <button
                                                onClick={() => { previewSharedDoc(doc); setVaultTab('received'); }}
                                                className="px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors shrink-0 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                                            >
                                                <FiEye size={12} /> View
                                            </button>
                                        )}
                                        <button
                                            onClick={() => dismissSharedDoc(doc.id)}
                                            className="p-1 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                                            title="Dismiss"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                )}

                {/* ===== SENT CO-SIGN REQUESTS ===== */}
                {sentCoSignRequests.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <FiSend size={14} /> Sent Requests
                                <span className="text-zinc-600 text-xs">{sentCoSignRequests.length}</span>
                            </h3>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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
                                    <div className="shrink-0 flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs rounded ${
                                            req.status === 'signed'
                                                ? 'bg-green-950/30 text-green-400'
                                                : 'bg-zinc-900 text-zinc-500'
                                        }`}>
                                            {req.status === 'signed' ? (req.request_type === 'witness' ? 'Witnessed' : 'Co-Signed') : 'Pending'}
                                        </span>
                                        {req.status === 'pending' && req.claim_token && (
                                            <button
                                                onClick={() => setVideoCallToken({ token: req.claim_token!, documentName: req.document_name })}
                                                className="px-2 py-1 text-xs rounded bg-blue-600/20 text-blue-400 border border-blue-900/40 hover:bg-blue-600/30 transition-all flex items-center gap-1 cursor-pointer"
                                                title="Start live video signing call"
                                            >
                                                <FiVideo size={10} /> Video Call
                                            </button>
                                        )}
                                        {req.status === 'signed' && req.response_document_id && (
                                            <button
                                                onClick={async () => {
                                                    setVaultTab('returned');
                                                    setExpandedSig(req.response_document_id!);
                                                    setPreviewLoading(true);
                                                    setPreviewData(null);
                                                    try {
                                                        const res = await fetch(`/api/bitsign/signatures/${req.response_document_id}/preview`);
                                                        if (!res.ok) throw new Error('Failed to load');
                                                        const blob = await res.blob();
                                                        const url = URL.createObjectURL(blob);
                                                        setPreviewData({ url, type: blob.type?.startsWith('image/') ? 'image' : (blob.type || 'image/png') });
                                                    } catch {
                                                        addToast('Failed to load co-signed document preview', 'warning');
                                                    } finally {
                                                        setPreviewLoading(false);
                                                    }
                                                    setTimeout(() => vaultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                                                }}
                                                className="px-2 py-1 text-xs rounded bg-green-900/30 text-green-400 border border-green-900/40 hover:bg-green-900/50 transition-all flex items-center gap-1"
                                            >
                                                <FiEye size={10} /> View
                                            </button>
                                        )}
                                        <button
                                            onClick={() => dismissCoSignRequest(req.id, 'sent')}
                                            className="p-1 text-zinc-700 hover:text-red-400 transition-colors"
                                            title="Dismiss"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== SELF-ATTESTATION (Lv.2 Upgrade) ===== */}
                {identity && !strands.some(s => s.strand_type === 'self_attestation') && (() => {
                    const s = getStrengthLabel(identity.identity_strength || 0);
                    return s.level < 2;
                })() && (
                    <div className="border border-blue-900/40 rounded-md bg-black">
                        <button
                            onClick={() => setSelfAttestOpen(!selfAttestOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                            <div className="flex items-center gap-2">
                                <FiShield className="text-blue-400" size={16} />
                                <span className="text-sm font-medium text-blue-400">Upgrade to Lv.2 Verified</span>
                                <span className="text-xs text-zinc-500">Self-attest your name and address</span>
                            </div>
                            {selfAttestOpen ? <FiChevronUp className="text-zinc-500" size={16} /> : <FiChevronDown className="text-zinc-500" size={16} />}
                        </button>
                        {selfAttestOpen && (
                            <div className="px-4 pb-4 space-y-3 border-t border-zinc-900">
                                <p className="text-xs text-zinc-500 pt-3">Declare your full legal name and address to upgrade your identity to Level 2. This information is stored as an on-chain attestation.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Full legal name"
                                        value={selfAttestForm.fullName}
                                        onChange={e => setSelfAttestForm(f => ({ ...f, fullName: e.target.value }))}
                                        className="col-span-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Address line 1"
                                        value={selfAttestForm.addressLine1}
                                        onChange={e => setSelfAttestForm(f => ({ ...f, addressLine1: e.target.value }))}
                                        className="col-span-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Address line 2 (optional)"
                                        value={selfAttestForm.addressLine2}
                                        onChange={e => setSelfAttestForm(f => ({ ...f, addressLine2: e.target.value }))}
                                        className="col-span-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="City"
                                        value={selfAttestForm.city}
                                        onChange={e => setSelfAttestForm(f => ({ ...f, city: e.target.value }))}
                                        className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Postcode"
                                        value={selfAttestForm.postcode}
                                        onChange={e => setSelfAttestForm(f => ({ ...f, postcode: e.target.value }))}
                                        className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Country"
                                        value={selfAttestForm.country}
                                        onChange={e => setSelfAttestForm(f => ({ ...f, country: e.target.value }))}
                                        className="col-span-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                    />
                                </div>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selfAttestAgreed}
                                        onChange={e => setSelfAttestAgreed(e.target.checked)}
                                        className="mt-0.5 accent-blue-500"
                                    />
                                    <span className="text-xs text-zinc-400">I attest that the information above is true and accurate to the best of my knowledge.</span>
                                </label>
                                {selfAttestError && (
                                    <p className="text-xs text-red-400 flex items-center gap-1"><FiAlertCircle size={12} /> {selfAttestError}</p>
                                )}
                                <button
                                    onClick={submitSelfAttestation}
                                    disabled={selfAttestSubmitting || !selfAttestAgreed || !selfAttestForm.fullName.trim() || !selfAttestForm.addressLine1.trim() || !selfAttestForm.city.trim() || !selfAttestForm.postcode.trim() || !selfAttestForm.country.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {selfAttestSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiShield size={14} />}
                                    {selfAttestSubmitting ? 'Submitting...' : 'Submit Self-Attestation'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== BIT TRUST IP VAULT ===== */}
                {identity && (
                    <div className="border border-amber-900/40 rounded-md bg-black">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30">
                            <div className="flex items-center gap-2">
                                <FiBookOpen className="text-amber-400" size={16} />
                                <span className="text-sm font-medium text-amber-400">Bit Trust IP Vault</span>
                                <span className="text-xs text-zinc-600">{ipThreads.length} thread{ipThreads.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        {ipThreads.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <p className="text-xs text-zinc-500">No IP threads registered yet.</p>
                                <p className="text-xs text-zinc-600 mt-1">Seal a document, then register it as an IP thread to build your patent chain.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-900/50">
                                {ipThreads.map((thread) => (
                                    <div key={thread.id} className="px-4 py-3 flex items-center justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{thread.label?.replace('IP: ', '') || 'Untitled'}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-zinc-600">#{thread.metadata?.sequence || '?'}</span>
                                                <span className="text-xs text-zinc-600">{new Date(thread.created_at).toLocaleDateString()}</span>
                                                {thread.strand_txid && (
                                                    <button
                                                        onClick={() => copyTxid(thread.strand_txid!)}
                                                        className="text-xs text-amber-600 hover:text-amber-400 flex items-center gap-1"
                                                    >
                                                        <FiCopy size={10} />
                                                        {copiedTxid === thread.strand_txid ? 'Copied' : thread.strand_txid.slice(0, 8) + '...'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {thread.strand_txid ? (
                                            <span className="px-2 py-0.5 text-xs bg-amber-950/30 text-amber-400 rounded">On-chain</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-xs bg-zinc-900 text-zinc-500 rounded">Local</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* IP Thread Registration Modal */}
                {ipThreadModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 w-full max-w-md">
                            <h3 className="text-sm font-medium text-white mb-1">Register IP Thread</h3>
                            <p className="text-xs text-zinc-500 mb-4">
                                Register &quot;{ipThreadModal.documentName}&quot; as a $401 IP thread. This creates an immutable on-chain record linking this document to your identity.
                            </p>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Thread title (e.g. Patent: ClawMiner v1)"
                                    value={ipThreadTitle}
                                    onChange={e => setIpThreadTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-amber-600 focus:outline-none"
                                />
                                <textarea
                                    placeholder="Description (optional)"
                                    value={ipThreadDescription}
                                    onChange={e => setIpThreadDescription(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:border-amber-600 focus:outline-none resize-none"
                                />
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => { setIpThreadModal(null); setIpThreadTitle(''); setIpThreadDescription(''); }}
                                    className="flex-1 px-4 py-2 text-sm text-zinc-400 border border-zinc-800 rounded hover:bg-zinc-900 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitIpThread}
                                    disabled={ipThreadSubmitting || !ipThreadTitle.trim()}
                                    className="flex-1 px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {ipThreadSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiBookOpen size={14} />}
                                    {ipThreadSubmitting ? 'Registering...' : 'Register'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== UNIFIED VAULT ===== */}
                <div ref={vaultRef} className="space-y-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-zinc-900">
                        {[
                            { key: 'all', label: 'All', count: signatures.length },
                            { key: 'received', label: 'Received', count: allReceivedDocs.length },
                            { key: 'documents', label: 'Unsealed', count: documents.length },
                            { key: 'sealed', label: 'Sealed', count: sealedItems.length },
                            { key: 'sent', label: 'Sent', count: sentItems.length },
                            { key: 'returned', label: 'Signed & Returned', count: signedReturnedItems.length },
                            { key: 'signatures', label: 'Signatures', count: signaturesOnly.length },
                            { key: 'media', label: 'Media', count: mediaItems.length },
                            { key: 'trash', label: 'Trash', count: trashItems.length },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setVaultTab(tab.key)}
                                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                                    vaultTab === tab.key
                                        ? 'border-white text-white'
                                        : tab.key === 'received' && tab.count > 0
                                        ? 'border-transparent text-blue-400 hover:text-blue-300'
                                        : tab.key === 'trash' && tab.count > 0
                                        ? 'border-transparent text-red-500/60 hover:text-red-400'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {tab.label} <span className={tab.key === 'received' && tab.count > 0 ? 'text-blue-400 ml-1' : 'text-zinc-600 ml-1'}>{tab.count}</span>
                            </button>
                        ))}
                    </div>

                    {signatures.length === 0 && allReceivedDocs.length === 0 && coSignRequests.length === 0 && trashItems.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-md text-center">
                            <FiEdit3 className="text-zinc-700 text-2xl mb-3" />
                            <p className="text-sm text-zinc-400 font-medium">No vault items yet</p>
                            <p className="text-xs text-zinc-600 mt-1">Create your first signature or upload a document.</p>
                        </div>
                    ) : (
                        <div className="grid lg:grid-cols-12 gap-3 h-[calc(100vh-12rem)]">
                            {/* LEFT — Item list / Signature Explorer */}
                            <div className="lg:col-span-4 border border-zinc-900 rounded-md bg-zinc-950/50 overflow-hidden flex flex-col">
                                {selectedDocBlobUrl && selectedDocumentId ? (
                                    /* Signing mode: show draggable signature explorer with thumbnails */
                                    <div className="flex-1 overflow-y-auto p-3">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                                            <span className="text-xs font-medium text-zinc-400">Signing workspace</span>
                                            <button
                                                onClick={closeDocumentCanvas}
                                                className="px-2 py-1 text-[10px] border border-zinc-700 bg-zinc-900 text-zinc-400 rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1"
                                            >
                                                <FiX size={10} /> Close workspace
                                            </button>
                                        </div>
                                        <SignatureExplorer
                                            signatures={signaturesOnly}
                                            media={mediaItems}
                                            registeredSignatureId={registeredSignatureId}
                                            onDragStart={() => {}}
                                            signingMode
                                            onSelect={async (sig, previewUrl) => {
                                                // Fetch SVG for compositing if TLDRAW
                                                let svgData: string | undefined;
                                                if (sig.signature_type === 'TLDRAW') {
                                                    try {
                                                        const res = await fetch(`/api/bitsign/signatures/${sig.id}/preview`);
                                                        if (res.ok) {
                                                            const ct = res.headers.get('content-type') || '';
                                                            if (ct.includes('svg')) {
                                                                svgData = await res.text();
                                                            }
                                                        }
                                                    } catch {}
                                                }
                                                const sigHeightPct = Math.min(8, 8 / docPageCount);
                                                const newEl: PlacedElement = {
                                                    id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                                    type: 'signature',
                                                    xPct: 25,
                                                    yPct: 2 / docPageCount,
                                                    widthPct: 20,
                                                    heightPct: sigHeightPct,
                                                    signatureId: sig.id,
                                                    signaturePreviewUrl: previewUrl || undefined,
                                                    signatureSvg: svgData,
                                                };
                                                setPlacedElements(prev => [...prev, newEl]);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    /* Browse mode: show compact item list */
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {vaultTab === 'received' ? (
                                            allReceivedDocs.length === 0 ? (
                                                <div className="py-8 text-center">
                                                    <FiInbox className="text-zinc-700 mx-auto mb-2" size={20} />
                                                    <p className="text-xs text-zinc-600">No received documents yet.</p>
                                                    <p className="text-[10px] text-zinc-700 mt-1">Documents shared with you will appear here.</p>
                                                </div>
                                            ) : allReceivedDocs.map((doc) => {
                                                const isSealed = doc.signature_type === 'SEALED_DOCUMENT' || doc.document_type === 'SEALED_DOCUMENT';
                                                const isSelected = expandedSig === doc.document_id;
                                                const matchingCoSign = coSignRequests.find(r => r.document_id === doc.document_id);
                                                const hasPendingCoSign = matchingCoSign?.status === 'pending';
                                                const hasSignedCoSign = matchingCoSign?.status === 'signed';
                                                return (
                                                    <div key={doc.id} className={`rounded transition-colors ${
                                                        isSelected ? 'bg-zinc-800 border border-zinc-700' : 'hover:bg-zinc-900 border border-transparent'
                                                    }`}>
                                                        <button
                                                            onClick={() => hasPendingCoSign ? openCoSign(doc) : previewSharedDoc(doc)}
                                                            className="w-full text-left p-2.5 flex items-center gap-2.5"
                                                        >
                                                            <div className="shrink-0">
                                                                {hasSignedCoSign ? <FiCheck size={14} className="text-green-400" /> :
                                                                 isSealed ? <FiShield size={14} className="text-amber-500" /> :
                                                                 <FiShare2 size={14} className="text-blue-400" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="block text-xs font-medium text-white truncate">
                                                                    {doc.metadata?.originalFileName || doc.metadata?.fileName || doc.metadata?.type || doc.signature_type || 'Shared Document'}
                                                                </span>
                                                                <span className="block text-[10px] text-zinc-600">
                                                                    From ${doc.grantor_handle} &middot; {new Date(doc.created_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="shrink-0 flex items-center gap-1">
                                                                {hasSignedCoSign ? (
                                                                    <span className="px-1.5 py-0.5 bg-green-950/30 text-green-400 text-[9px] rounded flex items-center gap-0.5">
                                                                        <FiCheck size={9} /> Returned
                                                                    </span>
                                                                ) : hasPendingCoSign ? (
                                                                    <span className="px-1.5 py-0.5 bg-amber-600/20 text-amber-400 text-[9px] rounded flex items-center gap-0.5">
                                                                        <FiEdit3 size={9} /> Co-Sign
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1 py-0.5 bg-blue-950/30 text-blue-400 text-[9px] rounded">Shared</span>
                                                                )}
                                                            </div>
                                                        </button>
                                                        {/* Manual "Return to Sender" for pending co-sign that user has already sealed */}
                                                        {hasPendingCoSign && signatures.some(s => s.signature_type === 'SEALED_DOCUMENT' && s.metadata?.originalDocumentId === doc.document_id) && (
                                                            <div className="px-2.5 pb-2">
                                                                <button
                                                                    onClick={async () => {
                                                                        const sealedDoc = signatures.find(s => s.signature_type === 'SEALED_DOCUMENT' && s.metadata?.originalDocumentId === doc.document_id);
                                                                        if (sealedDoc) {
                                                                            await handleCoSignResponse(sealedDoc.id, doc.document_id);
                                                                        }
                                                                    }}
                                                                    className="w-full px-2 py-1.5 bg-green-900/30 text-green-400 text-[10px] font-medium rounded border border-green-900/40 hover:bg-green-900/50 transition-all flex items-center justify-center gap-1"
                                                                >
                                                                    <FiSend size={10} /> Return Signed Document to Sender
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : vaultTab === 'returned' ? (
                                            signedReturnedItems.length === 0 ? (
                                                <div className="py-8 text-center">
                                                    <FiCheck className="text-zinc-700 mx-auto mb-2" size={20} />
                                                    <p className="text-xs text-zinc-600">No signed & returned documents yet.</p>
                                                </div>
                                            ) : signedReturnedItems.map((req) => (
                                                <button
                                                    key={req.id}
                                                    onClick={async () => {
                                                        if (req.response_document_id) {
                                                            // Response doc belongs to co-signer — preview via API (access grant allows it)
                                                            setExpandedSig(req.response_document_id);
                                                            setPreviewLoading(true);
                                                            setPreviewData(null);
                                                            try {
                                                                const res = await fetch(`/api/bitsign/signatures/${req.response_document_id}/preview`);
                                                                if (!res.ok) throw new Error('Failed to load');
                                                                const blob = await res.blob();
                                                                const url = URL.createObjectURL(blob);
                                                                setPreviewData({ url, type: blob.type?.startsWith('image/') ? 'image' : (blob.type || 'image/png') });
                                                            } catch {
                                                                addToast('Failed to load co-signed document preview', 'warning');
                                                            } finally {
                                                                setPreviewLoading(false);
                                                            }
                                                        }
                                                    }}
                                                    className={`w-full text-left p-2.5 rounded transition-colors flex items-center gap-2.5 border ${expandedSig === req.response_document_id ? 'bg-zinc-800 border-zinc-700' : 'hover:bg-zinc-900 border-transparent'}`}
                                                >
                                                    <div className="shrink-0">
                                                        <FiCheck size={14} className="text-green-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block text-xs font-medium text-white truncate">
                                                            {req.document_name}
                                                        </span>
                                                        <span className="block text-[10px] text-zinc-600">
                                                            Signed by ${req.recipient_handle || req.recipient_email || 'unknown'} &middot; {req.signed_at ? new Date(req.signed_at).toLocaleDateString() : ''}
                                                        </span>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1">
                                                        <span className="px-1 py-0.5 bg-green-950/30 text-green-400 text-[9px] rounded">{req.request_type === 'witness' ? 'Witnessed' : 'Co-Signed'}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (req.response_document_id) {
                                                                    const a = document.createElement('a');
                                                                    a.href = `/api/bitsign/signatures/${req.response_document_id}/preview`;
                                                                    a.download = `cosigned-${req.document_name}`;
                                                                    a.click();
                                                                    addToast('Downloading co-signed document...', 'download');
                                                                }
                                                            }}
                                                            className="px-1.5 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-400 text-[9px] rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1"
                                                        >
                                                            <FiDownload size={9} /> Download
                                                        </button>
                                                    </div>
                                                </button>
                                            ))
                                        ) : vaultTab === 'trash' ? (
                                            trashItems.length === 0 ? (
                                                <div className="py-8 text-center">
                                                    <FiX className="text-zinc-700 mx-auto mb-2" size={20} />
                                                    <p className="text-xs text-zinc-600">Trash is empty</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="px-2 py-2 flex items-center justify-between border-b border-zinc-800 mb-1">
                                                        <span className="text-[10px] text-zinc-600">{trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in trash</span>
                                                        <button
                                                            onClick={emptyTrash}
                                                            className="px-2 py-0.5 text-[10px] text-red-500/70 border border-red-900/20 rounded hover:text-red-400 hover:border-red-900/40 transition-colors"
                                                        >
                                                            Empty trash
                                                        </button>
                                                    </div>
                                                    {trashItems.map((sig) => {
                                                        const isSelected = expandedSig === sig.id;
                                                        const daysLeft = sig.deleted_at ? Math.max(0, 30 - Math.floor((Date.now() - new Date(sig.deleted_at).getTime()) / 86400000)) : 30;
                                                        return (
                                                            <div
                                                                key={sig.id}
                                                                className={`rounded transition-colors ${isSelected ? 'bg-zinc-800 border border-zinc-700' : 'hover:bg-zinc-900 border border-transparent'}`}
                                                            >
                                                                <button
                                                                    onClick={() => previewSignature(sig)}
                                                                    className="w-full text-left p-2.5 flex items-center gap-2.5"
                                                                >
                                                                    <div className="text-zinc-700 shrink-0">
                                                                        {sig.signature_type === 'SEALED_DOCUMENT' ? <FiShield size={14} /> :
                                                                         sig.signature_type === 'DOCUMENT' ? <FiFileText size={14} /> :
                                                                         sig.signature_type === 'TLDRAW' ? <FiEdit3 size={14} /> :
                                                                         sig.signature_type === 'CAMERA' ? <FiCamera size={14} /> :
                                                                         <FiFileText size={14} />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="block text-xs font-medium text-zinc-400 truncate line-through">
                                                                            {sig.metadata?.originalFileName || sig.metadata?.fileName || sig.metadata?.type || sig.signature_type}
                                                                        </span>
                                                                        <span className="block text-[10px] text-zinc-700">
                                                                            {daysLeft > 0 ? `Deletes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Pending deletion'}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                                {isSelected && (
                                                                    <div className="px-2.5 pb-2 flex items-center gap-1.5">
                                                                        <button
                                                                            onClick={() => restoreFromTrash(sig.id)}
                                                                            className="px-2 py-1 text-[10px] bg-green-900/30 text-green-400 rounded border border-green-900/30 hover:bg-green-900/50 transition-colors flex items-center gap-1"
                                                                        >
                                                                            <FiRotateCcw size={9} /> Restore
                                                                        </button>
                                                                        <button
                                                                            onClick={() => permanentDelete(sig.id)}
                                                                            className="px-2 py-1 text-[10px] bg-red-900/20 text-red-500 rounded border border-red-900/20 hover:bg-red-900/40 transition-colors flex items-center gap-1"
                                                                        >
                                                                            <FiX size={9} /> Delete forever
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )
                                        ) : filteredVaultItems.map((sig) => {
                                            const isOnChain = sig.txid && !sig.txid.startsWith('pending-');
                                            const isSigned = sig.wallet_signed;
                                            const isSealed = sig.signature_type === 'SEALED_DOCUMENT';
                                            const isRegistered = sig.id === registeredSignatureId;
                                            const isSelected = expandedSig === sig.id;
                                            return (
                                                <button
                                                    key={sig.id}
                                                    onClick={() => previewSignature(sig)}
                                                    className={`group w-full text-left p-2.5 rounded transition-colors flex items-center gap-2.5 ${
                                                        isSelected ? 'bg-zinc-800 border border-zinc-700' : 'hover:bg-zinc-900 border border-transparent'
                                                    }`}
                                                >
                                                    <div className="text-zinc-500 shrink-0">
                                                        {isSealed ? <FiShield size={14} className="text-amber-500" /> :
                                                         sig.signature_type === 'DOCUMENT' ? <FiFileText size={14} /> :
                                                         sig.signature_type === 'TLDRAW' ? <FiEdit3 size={14} /> :
                                                         sig.signature_type === 'CAMERA' ? <FiCamera size={14} /> :
                                                         sig.signature_type === 'VIDEO' ? <FiActivity size={14} /> :
                                                         <FiFileText size={14} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block text-xs font-medium text-white truncate">
                                                            {resolveDocName(sig)}
                                                        </span>
                                                        <span className="block text-[10px] text-zinc-600">
                                                            {new Date(sig.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1">
                                                        {isRegistered && <span className="px-1 py-0.5 bg-green-950 text-green-400 text-[9px] rounded font-medium">Registered</span>}
                                                        {isSealed && <span className="px-1 py-0.5 bg-amber-950 text-amber-400 text-[9px] rounded">Sealed</span>}
                                                        {isSigned ? (
                                                            <span className="px-1 py-0.5 bg-green-950/50 text-green-500 text-[9px] rounded flex items-center gap-0.5">
                                                                <FiCheck size={9} /> Attested
                                                            </span>
                                                        ) : isOnChain ? (
                                                            <FiCheck size={11} className="text-green-600" title="On-chain" />
                                                        ) : null}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); confirmDelete(sig.id, sig); }}
                                                            className="p-0.5 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete"
                                                        >
                                                            <FiX size={11} />
                                                        </button>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* RIGHT — Viewer / Canvas */}
                            <div className="lg:col-span-8 border border-zinc-900 rounded-md bg-zinc-950/50 overflow-hidden flex flex-col">
                                {selectedDocBlobUrl && selectedDocumentId ? (
                                    <DocumentCanvas
                                        documentUrl={selectedDocBlobUrl}
                                        documentId={selectedDocumentId}
                                        signerHandle={handle || undefined}
                                        signerName={strands.find(s => s.strand_type === 'self_attestation')?.label?.replace('Self-attested: ', '') || identity?.linkedin_name || undefined}
                                        signerIdentities={[
                                            identity?.google_email && `✉ ${identity.google_email}`,
                                            identity?.microsoft_email && identity.microsoft_email !== identity?.google_email && `✉ ${identity.microsoft_email}`,
                                            identity?.linkedin_name && `LinkedIn: ${identity.linkedin_name}`,
                                            identity?.twitter_handle && `𝕏 @${identity.twitter_handle}`,
                                            identity?.github_handle && `GitHub: ${identity.github_handle}`,
                                        ].filter(Boolean) as string[]}
                                        originalFileName={signatures.find(s => s.id === selectedDocumentId)?.metadata?.fileName || signatures.find(s => s.id === selectedDocumentId)?.metadata?.originalFileName}
                                        existingSealCount={(() => {
                                            // Count how many times this document has been sealed in the chain
                                            let count = 0;
                                            const doc = signatures.find(s => s.id === selectedDocumentId);
                                            if (doc?.signature_type === 'SEALED_DOCUMENT') count++;
                                            // Check if the original was also sealed
                                            if (doc?.metadata?.originalDocumentId) {
                                                const orig = signatures.find(s => s.id === doc.metadata.originalDocumentId);
                                                if (orig?.signature_type === 'SEALED_DOCUMENT') count++;
                                            }
                                            // Also count if this is a shared doc being co-signed (it's already sealed once)
                                            if (sharedWithMe.some(s => s.document_id === selectedDocumentId)) count = Math.max(count, 1);
                                            return count;
                                        })()}
                                        elements={placedElements}
                                        onElementsChange={setPlacedElements}
                                        onSeal={handleSeal}
                                        onClose={closeDocumentCanvas}
                                        onEmailRecipients={() => {
                                            const fileName = signatures.find(s => s.id === selectedDocumentId)?.metadata?.fileName || 'Document';
                                            setShareModal({ documentId: selectedDocumentId!, documentType: 'vault_item', itemType: 'DOCUMENT', itemLabel: fileName });
                                        }}
                                        onSaveSignature={saveSignatureFromCanvas}
                                        pageCount={docPageCount}
                                        onEffectivePagesDetected={(pages) => setDocPageCount(pages)}
                                    />
                                ) : expandedSig ? (
                                    <div className="flex flex-col h-full">
                                        {/* Actions bar — TOP of viewer */}
                                        {(() => {
                                            const sig = signatures.find(s => s.id === expandedSig);
                                            if (!sig) return null;
                                            const isOnChain = sig.txid && !sig.txid.startsWith('pending-');
                                            const isSigned = sig.wallet_signed;
                                            const isSealed = sig.signature_type === 'SEALED_DOCUMENT';
                                            const isRegistered = sig.id === registeredSignatureId;
                                            return (
                                                <div className="border-b border-zinc-900 p-3 space-y-2 shrink-0">
                                                    {isSealed && (
                                                        <div className="flex items-center gap-2 flex-wrap pb-2 mb-2 border-b border-zinc-800">
                                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Send:</span>
                                                            <button onClick={() => setCoSignModal({ documentId: sig.id, documentName: resolveDocName(sig) })} className="px-2.5 py-1 bg-white text-black text-xs font-medium rounded hover:bg-zinc-200 transition-all flex items-center gap-1.5"><FiEdit3 size={11} /> Co-Sign</button>
                                                            <button onClick={() => setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: 'SEALED_DOCUMENT', itemLabel: resolveDocName(sig) })} className="px-2.5 py-1 bg-amber-600 text-black text-xs font-medium rounded hover:bg-amber-500 transition-all flex items-center gap-1.5"><FiMail size={11} /> Email</button>
                                                            <button onClick={() => setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: 'SEALED_DOCUMENT_HC', itemLabel: resolveDocName(sig) })} className="px-2.5 py-1 bg-green-600 text-black text-xs font-medium rounded hover:bg-green-500 transition-all flex items-center gap-1.5"><FiUsers size={11} /> Seal &amp; Send</button>
                                                            <button onClick={() => setCoSignModal({ documentId: sig.id, documentName: resolveDocName(sig), requestType: 'witness' })} className="px-2.5 py-1 bg-blue-600 text-black text-xs font-medium rounded hover:bg-blue-500 transition-all flex items-center gap-1.5"><FiEye size={11} /> Witness</button>
                                                            {!ipThreads.some(t => t.metadata?.documentId === sig.id) && (
                                                                <button onClick={() => setIpThreadModal({ documentId: sig.id, documentName: resolveDocName(sig) })} className="px-2.5 py-1 bg-amber-700 text-white text-xs font-medium rounded hover:bg-amber-600 transition-all flex items-center gap-1.5"><FiBookOpen size={11} /> IP Thread</button>
                                                            )}
                                                            {!sig.metadata?.sent && (
                                                                <button onClick={() => markAsSent(sig.id)} className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5"><FiSend size={11} /> Mark as Sent</button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {sig.signature_type === 'DOCUMENT' && (
                                                            <button onClick={() => openDocumentInCanvas(sig.id)} className="px-2.5 py-1 bg-amber-600 text-black text-xs font-medium rounded hover:bg-amber-500 transition-all flex items-center gap-1.5"><FiEdit3 size={11} /> Sign</button>
                                                        )}
                                                        {sig.signature_type === 'TLDRAW' && isOnChain && !isRegistered && (
                                                            <button onClick={() => registerSignature(sig.id)} className="px-2.5 py-1 bg-white text-black text-xs font-medium rounded hover:bg-zinc-200 transition-all flex items-center gap-1.5"><FiEdit3 size={11} /> Register</button>
                                                        )}
                                                        {!isSigned && (
                                                            <button onClick={() => attestSignature(sig.id)} className="px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-500 transition-all flex items-center gap-1.5"><FiShield size={11} /> Seal</button>
                                                        )}
                                                        <button onClick={() => setShareModal({ documentId: sig.id, documentType: 'vault_item', itemType: sig.signature_type, itemLabel: sig.metadata?.type || sig.signature_type })} className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5"><FiShare2 size={11} /> Share</button>
                                                        <button onClick={() => downloadSignature(sig.id, sig)} className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5"><FiDownload size={11} /> Download</button>
                                                        {sig.signature_type === 'CAMERA' && isSigned && (
                                                            <button
                                                                onClick={() => setAsProfilePicture(sig.id)}
                                                                className={`px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
                                                                    identity?.avatar_url?.includes(sig.id)
                                                                        ? 'bg-green-950 text-green-400 border border-green-900/40'
                                                                        : 'bg-blue-600 text-white hover:bg-blue-500'
                                                                }`}
                                                                disabled={identity?.avatar_url?.includes(sig.id)}
                                                            >
                                                                <FiCamera size={11} />
                                                                {identity?.avatar_url?.includes(sig.id) ? 'Current Profile Pic' : 'Use as Profile Pic'}
                                                            </button>
                                                        )}
                                                        {sig.signature_type === 'CAMERA' && !isSigned && (
                                                            <span className="px-2.5 py-1 text-[10px] text-zinc-600 italic">Attest to use as profile pic</span>
                                                        )}
                                                        {isOnChain && (
                                                            <a href={`https://whatsonchain.com/tx/${sig.txid}`} target="_blank" className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5"><FiExternalLink size={11} /> Chain</a>
                                                        )}
                                                        {isSealed && (
                                                            <button onClick={() => unsealDocument(sig.id)} className="px-2.5 py-1 border border-amber-900/30 bg-black text-amber-700 text-xs rounded hover:text-amber-400 hover:border-amber-800 transition-all flex items-center gap-1.5 ml-auto"><FiLock size={11} /> Unseal</button>
                                                        )}
                                                        <button onClick={() => confirmDelete(sig.id, sig)} className={`px-2.5 py-1 border border-red-900/30 bg-black text-red-900 text-xs rounded hover:text-red-400 hover:border-red-800 transition-all flex items-center gap-1.5 ${!isSealed ? 'ml-auto' : ''}`}><FiX size={11} /> Delete</button>
                                                        <button onClick={() => { setExpandedSig(null); setPreviewData(null); }} className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5"><FiX size={11} /> Close</button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* Preview */}
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {previewLoading ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full opacity-20" />
                                                </div>
                                            ) : previewData?.type === 'svg' ? (
                                                <div className="bg-white rounded-md p-6 flex items-center justify-center">
                                                    <img src={previewData.url} alt="Signature" className="max-h-48 w-auto" />
                                                </div>
                                            ) : previewData?.type === 'image' ? (
                                                <div className="space-y-2">
                                                    <div
                                                        className="bg-white rounded-md overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-zinc-600 transition-all"
                                                        onClick={() => setFullscreenPreview(previewData.url)}
                                                        title="Click to view full size"
                                                    >
                                                        <img
                                                            src={previewData.url}
                                                            alt="Photo"
                                                            className="max-h-[400px] w-full object-contain transition-transform duration-200"
                                                            style={{ transform: `rotate(${previewRotation}deg)` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                                                            className="px-3 py-1.5 border border-zinc-800 bg-zinc-900 text-zinc-400 text-xs rounded hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5"
                                                        >
                                                            <FiRotateCcw size={11} /> Rotate
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : previewData?.type === 'pdf' ? (
                                                <iframe src={previewData.url} className="w-full h-[500px] rounded-md border border-zinc-800" />
                                            ) : previewData?.type === 'video' ? (
                                                <video src={previewData.url} controls className="w-full max-h-[400px] rounded-md" />
                                            ) : previewData?.type === 'decrypt-failed' ? (
                                                <div className="text-center py-8 space-y-2">
                                                    <FiLock className="mx-auto text-amber-500" size={24} />
                                                    <p className="text-sm text-amber-400">Unable to decrypt</p>
                                                </div>
                                            ) : previewData?.type === 'no-data' ? (
                                                <div className="text-center py-8">
                                                    <p className="text-xs text-zinc-500">No encrypted data stored</p>
                                                </div>
                                            ) : previewData?.type === 'no-key' ? (
                                                <div className="text-center py-8">
                                                    <p className="text-xs text-zinc-500">Encryption key not available</p>
                                                </div>
                                            ) : previewData?.type === 'error' ? (
                                                <p className="text-xs text-red-400 text-center py-6">Failed to load preview</p>
                                            ) : previewData?.type === 'unsupported' ? (
                                                <p className="text-xs text-zinc-500 text-center py-6">Preview not available</p>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                        <FiEye className="text-zinc-800 text-3xl mb-3" />
                                        <p className="text-sm text-zinc-600">Select an item to preview</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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
                        requestType={coSignModal.requestType || 'co-sign'}
                        onSubmit={submitCoSignRequest}
                        onClose={() => setCoSignModal(null)}
                    />
                )}

                {/* Peer Attestation Request Modal */}
                {peerAttestModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPeerAttestModal(false)}>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <FiUserCheck className="text-blue-400" size={20} />
                                    Request Peer Attestation
                                </h3>
                                <button onClick={() => setPeerAttestModal(false)} className="text-zinc-500 hover:text-white"><FiX size={18} /></button>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Ask a trusted peer to attest your identity. They will sign a formal declaration confirming they know you and have witnessed your identity documents.
                            </p>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Peer's HandCash handle (e.g. johndoe)"
                                    value={peerAttestHandle}
                                    onChange={(e) => setPeerAttestHandle(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
                                />
                                <textarea
                                    placeholder="Optional message to your peer..."
                                    value={peerAttestMessage}
                                    onChange={(e) => setPeerAttestMessage(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-blue-600 focus:outline-none resize-none"
                                />
                            </div>
                            <button
                                onClick={requestPeerAttestation}
                                disabled={peerAttestSubmitting || !peerAttestHandle.trim()}
                                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {peerAttestSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
                                {peerAttestSubmitting ? 'Sending...' : 'Send Attestation Request'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Peer Attestation Respond Modal */}
                {peerAttestRespondModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPeerAttestRespondModal(null)}>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <FiShield className="text-green-400" size={20} />
                                    Sign Peer Attestation
                                </h3>
                                <button onClick={() => setPeerAttestRespondModal(null)} className="text-zinc-500 hover:text-white"><FiX size={18} /></button>
                            </div>
                            <div className="bg-black border border-zinc-800 rounded-lg p-4 space-y-3">
                                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Pro-Forma Witness Declaration</p>
                                <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
                                    <p>I, <span className="text-white font-semibold">{handle}</span>, hereby attest that the individual known as <span className="text-white font-semibold">${peerAttestRespondModal.requester_handle}</span> is known to me personally.</p>
                                    <p>I confirm that I have witnessed their identity documents and I trust that they are the person in control of their HandCash handle.</p>
                                    <p>I make this declaration in good faith on <span className="text-white font-semibold">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>.</p>
                                </div>
                                {peerAttestRespondModal.message && (
                                    <div className="border-t border-zinc-800 pt-2">
                                        <p className="text-xs text-zinc-500">Message from requester:</p>
                                        <p className="text-xs text-zinc-400 italic">&ldquo;{peerAttestRespondModal.message}&rdquo;</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPeerAttestRespondModal(null)}
                                    className="flex-1 px-4 py-2.5 border border-zinc-800 text-zinc-400 text-sm rounded-lg hover:text-white hover:border-zinc-600 transition-colors"
                                >
                                    Decline
                                </button>
                                <button
                                    onClick={() => {
                                        const declaration = `I, ${handle}, hereby attest that the individual known as $${peerAttestRespondModal.requester_handle} is known to me personally. I confirm that I have witnessed their identity documents and I trust that they are the person in control of their HandCash handle. Signed on ${new Date().toISOString()}.`;
                                        respondPeerAttestation(peerAttestRespondModal.id, declaration);
                                    }}
                                    disabled={peerAttestRespondSubmitting}
                                    className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {peerAttestRespondSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiShield size={14} />}
                                    {peerAttestRespondSubmitting ? 'Signing...' : 'Sign & Attest'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete confirmation modal */}
                {deleteConfirmModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteConfirmModal(null)}>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${deleteConfirmModal.isSealed ? 'bg-red-950 border border-red-900/40' : 'bg-zinc-900 border border-zinc-800'}`}>
                                    <FiX size={18} className={deleteConfirmModal.isSealed ? 'text-red-400' : 'text-zinc-400'} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Delete {deleteConfirmModal.isSealed ? 'sealed document' : 'item'}?</h3>
                                    <p className="text-xs text-zinc-500 truncate max-w-[200px]">{deleteConfirmModal.name}</p>
                                </div>
                            </div>
                            {deleteConfirmModal.isSealed && (
                                <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-3 space-y-1">
                                    <p className="text-xs text-red-400 font-medium flex items-center gap-1.5"><FiAlertCircle size={12} /> This is a sealed document</p>
                                    <p className="text-[11px] text-red-400/70 leading-relaxed">
                                        This document has been sealed and may be recorded on-chain. Deleting it removes your local copy permanently. The blockchain record (if any) will remain.
                                    </p>
                                </div>
                            )}
                            <p className="text-xs text-zinc-400">
                                {deleteConfirmModal.isSealed
                                    ? 'This cannot be undone. The item will be moved to trash and permanently deleted after 30 days.'
                                    : 'This item will be moved to trash and permanently deleted after 30 days.'}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDeleteConfirmModal(null)}
                                    className="flex-1 px-4 py-2.5 border border-zinc-800 text-zinc-400 text-sm rounded-lg hover:text-white hover:border-zinc-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const id = deleteConfirmModal.id;
                                        setDeleteConfirmModal(null);
                                        await deleteSignature(id);
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FiX size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fullscreen document preview modal */}
                {fullscreenPreview && (
                    <div
                        className="fixed inset-0 z-[95] bg-black/95 backdrop-blur-sm flex flex-col"
                        onClick={() => setFullscreenPreview(null)}
                    >
                        <div className="flex items-center justify-between px-4 py-3 shrink-0">
                            <span className="text-xs text-zinc-500">Click anywhere or press Esc to close</span>
                            <div className="flex items-center gap-2">
                                <a
                                    href={fullscreenPreview}
                                    download="document.png"
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs rounded hover:text-white hover:border-zinc-500 transition-all flex items-center gap-1.5"
                                >
                                    <FiDownload size={12} /> Download
                                </a>
                                <button
                                    onClick={() => setFullscreenPreview(null)}
                                    className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs rounded hover:text-white hover:border-zinc-500 transition-all flex items-center gap-1.5"
                                >
                                    <FiX size={12} /> Close
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <img
                                src={fullscreenPreview}
                                alt="Document full view"
                                className="w-full max-w-4xl mx-auto cursor-default"
                                style={{ imageRendering: 'auto' }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
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

                {/* Video Call floating panel */}
                {videoCallToken && handle && (
                    <VideoCall
                        roomToken={videoCallToken.token}
                        displayName={handle}
                        documentName={videoCallToken.documentName}
                        onClose={() => setVideoCallToken(null)}
                    />
                )}
            </div>
        </div>
    );
}

// Inline modal for co-sign requests
function CoSignRequestModal({ documentName, requestType = 'co-sign', onSubmit, onClose }: {
    documentName: string;
    requestType?: 'co-sign' | 'witness';
    onSubmit: (handle: string, email: string, message: string) => Promise<any>;
    onClose: () => void;
}) {
    const isWitness = requestType === 'witness';
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
                        {isWitness ? <><FiEye size={18} /> Request Witness</> : <><FiEdit3 size={18} /> Request Co-Sign</>}
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <FiX size={18} />
                    </button>
                </div>

                <p className="text-xs text-zinc-500">
                    {isWitness ? 'Request a witness signature on' : 'Request a co-signature on'} <span className="text-white font-medium">&ldquo;{documentName}&rdquo;</span>
                </p>

                {success ? (
                    <div className="text-center py-8 space-y-3">
                        <div className="w-12 h-12 bg-green-950/30 border border-green-800 rounded-full flex items-center justify-center mx-auto">
                            <FiCheck className="text-green-400" size={20} />
                        </div>
                        <p className="text-sm text-green-400 font-medium">{isWitness ? 'Witness' : 'Co-sign'} request sent!</p>
                        <p className="text-xs text-zinc-500">They&apos;ll be notified and can {isWitness ? 'witness' : 'co-sign'} from their inbox.</p>
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
                                placeholder={isWitness ? 'Please witness this document...' : 'Please co-sign this document...'}
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
