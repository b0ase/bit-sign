'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiShield, FiUpload, FiHash, FiCopy, FiExternalLink, FiFile, FiImage, FiVideo, FiLoader, FiCheck, FiFilter } from 'react-icons/fi';

type FilterType = 'all' | 'documents' | 'media' | 'hashes';

interface IpThread {
    id: string;
    title: string;
    documentHash: string;
    documentType: string;
    sequence: number;
    txid: string;
    documentId: string | null;
    createdAt: string;
}

function getTypeIcon(type: string) {
    switch (type) {
        case 'IMAGE':
        case 'PHOTO':
            return FiImage;
        case 'VIDEO':
            return FiVideo;
        default:
            return FiFile;
    }
}

function getTypeBadge(type: string): { label: string; color: string } {
    switch (type) {
        case 'SEALED_DOCUMENT': return { label: 'Sealed', color: 'bg-blue-950/40 text-blue-400 border-blue-900/40' };
        case 'DOCUMENT': return { label: 'Doc', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
        case 'PDF': return { label: 'PDF', color: 'bg-red-950/40 text-red-400 border-red-900/40' };
        case 'IMAGE':
        case 'PHOTO': return { label: 'Image', color: 'bg-purple-950/40 text-purple-400 border-purple-900/40' };
        case 'VIDEO': return { label: 'Video', color: 'bg-pink-950/40 text-pink-400 border-pink-900/40' };
        case 'BIT_TRUST': return { label: 'Trust', color: 'bg-amber-950/40 text-amber-400 border-amber-900/40' };
        case 'HASH_ONLY': return { label: 'Hash', color: 'bg-green-950/40 text-green-400 border-green-900/40' };
        default: return { label: type, color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    }
}

function matchesFilter(type: string, filter: FilterType): boolean {
    if (filter === 'all') return true;
    if (filter === 'documents') return ['SEALED_DOCUMENT', 'DOCUMENT', 'PDF', 'BIT_TRUST'].includes(type);
    if (filter === 'media') return ['IMAGE', 'PHOTO', 'VIDEO'].includes(type);
    if (filter === 'hashes') return type === 'HASH_ONLY';
    return true;
}

async function computeSHA256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function BitTrustPage() {
    const [handle, setHandle] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [threads, setThreads] = useState<IpThread[]>([]);
    const [filter, setFilter] = useState<FilterType>('all');
    const [copiedTxid, setCopiedTxid] = useState<string | null>(null);

    // Upload mode state
    const [mode, setMode] = useState<'upload' | 'hash'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [fileHash, setFileHash] = useState('');
    const [hashInput, setHashInput] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auth check
    useEffect(() => {
        const cookies = document.cookie.split('; ');
        const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
        if (handleCookie) {
            const h = handleCookie.split('=')[1];
            setHandle(h);
            fetchThreads();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchThreads = async () => {
        try {
            const res = await fetch('/api/bitsign/ip-thread');
            if (!res.ok) return;
            const data = await res.json();
            setThreads(data.threads || []);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setFileHash('');
        setError('');
        try {
            const hash = await computeSHA256(f);
            setFileHash(hash);
        } catch {
            setError('Failed to compute file hash');
        }
    }, []);

    const copyTxid = useCallback((txid: string) => {
        navigator.clipboard.writeText(txid);
        setCopiedTxid(txid);
        setTimeout(() => setCopiedTxid(null), 2000);
    }, []);

    const handleSubmit = useCallback(async () => {
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            if (mode === 'upload') {
                if (!file || !fileHash || !title.trim()) {
                    setError('Select a file and enter a title');
                    return;
                }

                // Step 1: Upload document via inscribe endpoint
                const reader = new FileReader();
                const base64: string = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const rawBase64 = base64.replace(/^data:[^;]+;base64,/, '');

                const uploadRes = await fetch('/api/bitsign/inscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signatureType: 'DOCUMENT',
                        payload: rawBase64,
                        metadata: { fileName: file.name, mimeType: file.type },
                    }),
                });

                if (!uploadRes.ok) {
                    const data = await uploadRes.json().catch(() => ({}));
                    throw new Error(data.error || 'Upload failed');
                }

                const { id: documentId } = await uploadRes.json();

                // Step 2: Register IP thread with documentId
                const threadRes = await fetch('/api/bitsign/ip-thread', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        documentId,
                        title: title.trim(),
                        description: description.trim(),
                    }),
                });

                if (!threadRes.ok) {
                    const data = await threadRes.json().catch(() => ({}));
                    throw new Error(data.error || 'IP thread registration failed');
                }

                const result = await threadRes.json();
                setSuccess(`Registered! TXID: ${result.strandTxid || result.inscriptionTxid || 'pending'}`);
            } else {
                // Hash-only mode
                if (!hashInput.trim() || !title.trim()) {
                    setError('Enter a hash and title');
                    return;
                }

                const threadRes = await fetch('/api/bitsign/ip-thread', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        documentHash: hashInput.trim(),
                        title: title.trim(),
                        description: description.trim(),
                    }),
                });

                if (!threadRes.ok) {
                    const data = await threadRes.json().catch(() => ({}));
                    throw new Error(data.error || 'IP thread registration failed');
                }

                const result = await threadRes.json();
                setSuccess(`Registered! TXID: ${result.strandTxid || result.inscriptionTxid || 'pending'}`);
            }

            // Reset form and refresh
            setFile(null);
            setFileHash('');
            setHashInput('');
            setTitle('');
            setDescription('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            await fetchThreads();
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setSubmitting(false);
        }
    }, [mode, file, fileHash, hashInput, title, description]);

    // Auth gate
    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!handle) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <FiShield size={48} className="text-zinc-700 mb-4" />
                <h1 className="text-xl font-bold text-white mb-2">Bit Trust IP Vault</h1>
                <p className="text-zinc-500 text-sm mb-6">Sign in to manage your intellectual property.</p>
                <a
                    href="/api/auth/handcash"
                    className="px-6 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-200 transition-colors"
                >
                    Sign in with HandCash
                </a>
            </div>
        );
    }

    const filteredThreads = threads.filter(t => matchesFilter(t.documentType, filter));

    return (
        <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-12">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <FiShield size={24} className="text-amber-400" />
                        <h1 className="text-2xl font-bold text-white">Bit Trust IP Vault</h1>
                    </div>
                    <p className="text-zinc-500 text-sm">Your intellectual property, on-chain. Upload documents or register hashes as immutable proof.</p>
                </div>

                {/* Mode toggle + form */}
                <div className="border border-zinc-800 rounded-lg p-4 sm:p-6 mb-8">
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => { setMode('upload'); setError(''); setSuccess(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                mode === 'upload'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                            }`}
                        >
                            <FiUpload size={14} />
                            Upload Document
                        </button>
                        <button
                            onClick={() => { setMode('hash'); setError(''); setSuccess(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                mode === 'hash'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                            }`}
                        >
                            <FiHash size={14} />
                            Register Hash
                        </button>
                    </div>

                    {mode === 'upload' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">File</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileSelect}
                                    className="w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer"
                                />
                            </div>
                            {fileHash && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">SHA-256</span>
                                    <p className="text-xs text-green-400 font-mono break-all mt-0.5">{fileHash}</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Patent: Novel Algorithm v1"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-md text-sm text-white placeholder-zinc-600 focus:border-amber-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Description (optional)</label>
                                <textarea
                                    placeholder="Brief description of the IP..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-md text-sm text-white placeholder-zinc-600 focus:border-amber-600 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">SHA-256 Hash</label>
                                <input
                                    type="text"
                                    placeholder="Paste a SHA-256 hash (64 hex characters)"
                                    value={hashInput}
                                    onChange={e => setHashInput(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-md text-sm text-white font-mono placeholder-zinc-600 focus:border-amber-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Source Code Commit abc123"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-md text-sm text-white placeholder-zinc-600 focus:border-amber-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Description (optional)</label>
                                <textarea
                                    placeholder="Brief description..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-md text-sm text-white placeholder-zinc-600 focus:border-amber-600 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 px-3 py-2 bg-red-950/30 border border-red-900/40 rounded-md text-sm text-red-400">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mt-4 px-3 py-2 bg-green-950/30 border border-green-900/40 rounded-md text-sm text-green-400">
                            {success}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !title.trim() || (mode === 'upload' ? !fileHash : !hashInput.trim())}
                        className="mt-4 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <FiLoader className="animate-spin" size={14} />
                                Registering...
                            </>
                        ) : (
                            <>
                                <FiShield size={14} />
                                {mode === 'upload' ? 'Register IP' : 'Register Hash'}
                            </>
                        )}
                    </button>
                </div>

                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-4">
                    <FiFilter size={14} className="text-zinc-600" />
                    {(['all', 'documents', 'media', 'hashes'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                filter === f
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-zinc-900 text-zinc-500 hover:text-white border border-zinc-800'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                    <span className="text-xs text-zinc-600 ml-auto">{filteredThreads.length} thread{filteredThreads.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Threads grid */}
                {filteredThreads.length === 0 ? (
                    <div className="border border-zinc-800 rounded-lg p-12 text-center">
                        <FiShield size={32} className="text-zinc-800 mx-auto mb-3" />
                        <p className="text-zinc-500 text-sm">
                            {threads.length === 0 ? 'No IP threads registered yet.' : 'No threads match this filter.'}
                        </p>
                        <p className="text-zinc-600 text-xs mt-1">Upload a document or register a hash to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredThreads.map(thread => {
                            const TypeIcon = getTypeIcon(thread.documentType);
                            const badge = getTypeBadge(thread.documentType);
                            const isOnChain = !!thread.txid;

                            return (
                                <div
                                    key={thread.id}
                                    className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                                            {thread.documentType === 'HASH_ONLY' ? (
                                                <FiHash size={18} className="text-green-400" />
                                            ) : (
                                                <TypeIcon size={18} className="text-zinc-400" />
                                            )}
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                    </div>

                                    <h3 className="text-sm font-medium text-white truncate mb-1">{thread.title}</h3>

                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] text-zinc-600">#{thread.sequence}</span>
                                        <span className="text-[10px] text-zinc-600">
                                            {new Date(thread.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>

                                    {/* Status + actions */}
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-0.5 text-[10px] rounded ${
                                            isOnChain
                                                ? 'bg-green-950/30 text-green-400'
                                                : 'bg-yellow-950/30 text-yellow-400'
                                        }`}>
                                            {isOnChain ? 'On-chain' : 'Pending'}
                                        </span>
                                        {thread.txid && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => copyTxid(thread.txid)}
                                                    className="p-1 text-zinc-600 hover:text-white transition-colors"
                                                    title="Copy TXID"
                                                >
                                                    {copiedTxid === thread.txid ? (
                                                        <FiCheck size={12} className="text-green-400" />
                                                    ) : (
                                                        <FiCopy size={12} />
                                                    )}
                                                </button>
                                                <a
                                                    href={`https://whatsonchain.com/tx/${thread.txid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 text-zinc-600 hover:text-white transition-colors"
                                                    title="View on WhatsOnChain"
                                                >
                                                    <FiExternalLink size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
