'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiEdit3, FiCamera, FiActivity, FiCheck } from 'react-icons/fi';

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

interface SignatureExplorerProps {
    signatures: Signature[];
    media: Signature[];
    registeredSignatureId: string | null;
    onDragStart: (sig: Signature, previewUrl: string) => void;
}

export default function SignatureExplorer({ signatures, media, registeredSignatureId, onDragStart }: SignatureExplorerProps) {
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    const loadThumbnail = useCallback(async (sig: Signature) => {
        if (thumbnails[sig.id] || loadingIds.has(sig.id)) return;
        setLoadingIds(prev => new Set(prev).add(sig.id));
        try {
            const res = await fetch(`/api/bitsign/signatures/${sig.id}/preview`);
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setThumbnails(prev => ({ ...prev, [sig.id]: url }));
        } catch {
            // Thumbnail load failed silently
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(sig.id);
                return next;
            });
        }
    }, [thumbnails, loadingIds]);

    useEffect(() => {
        // Load thumbnails for all signatures
        for (const sig of signatures) {
            loadThumbnail(sig);
        }
        for (const m of media) {
            loadThumbnail(m);
        }
    }, [signatures.length, media.length]);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            Object.values(thumbnails).forEach(url => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
        };
    }, []);

    const handleDragStart = (e: React.DragEvent, sig: Signature) => {
        const url = thumbnails[sig.id] || '';
        e.dataTransfer.setData('application/json', JSON.stringify({
            signatureId: sig.id,
            signatureType: sig.signature_type,
            previewUrl: url,
        }));
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(sig, url);
    };

    return (
        <div className="h-full overflow-y-auto space-y-6 pr-1">
            {/* Signatures Section */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <FiEdit3 size={12} /> Signatures ({signatures.length})
                </h4>
                {signatures.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic py-4 text-center">No signatures yet</p>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {signatures.map(sig => {
                            const isRegistered = sig.id === registeredSignatureId;
                            const thumb = thumbnails[sig.id];
                            return (
                                <div
                                    key={sig.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, sig)}
                                    className={`relative border rounded-md p-2 cursor-grab active:cursor-grabbing transition-all hover:border-zinc-600 bg-zinc-950 group ${
                                        isRegistered ? 'border-green-800 ring-1 ring-green-900/30' : 'border-zinc-800'
                                    }`}
                                    title={isRegistered ? 'Registered signing signature — drag onto a document' : 'Drag onto a document to place'}
                                >
                                    <div className="aspect-[3/2] bg-white rounded overflow-hidden flex items-center justify-center">
                                        {thumb ? (
                                            <img src={thumb} alt="Signature" className="max-w-full max-h-full object-contain" draggable={false} />
                                        ) : (
                                            <div className="w-6 h-6 border-t-2 border-zinc-300 animate-spin rounded-full" />
                                        )}
                                    </div>
                                    {isRegistered && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-green-900 rounded-full flex items-center justify-center">
                                            <FiCheck size={10} className="text-green-400" />
                                        </div>
                                    )}
                                    <p className="text-[10px] text-zinc-500 mt-1.5 truncate text-center group-hover:text-zinc-300 transition-colors">
                                        {new Date(sig.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Media Section */}
            {media.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <FiCamera size={12} /> Media ({media.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {media.map(m => {
                            const thumb = thumbnails[m.id];
                            const isVideo = m.signature_type === 'VIDEO';
                            return (
                                <div
                                    key={m.id}
                                    className="border border-zinc-800 rounded-md p-2 bg-zinc-950"
                                >
                                    <div className="aspect-square bg-zinc-900 rounded overflow-hidden flex items-center justify-center">
                                        {thumb ? (
                                            isVideo ? (
                                                <video src={thumb} className="max-w-full max-h-full object-contain" muted />
                                            ) : (
                                                <img src={thumb} alt="Media" className="max-w-full max-h-full object-contain" />
                                            )
                                        ) : (
                                            <div className="text-zinc-700">
                                                {isVideo ? <FiActivity size={20} /> : <FiCamera size={20} />}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1.5 truncate text-center">
                                        {m.metadata?.type || (isVideo ? 'Video' : 'Photo')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Drag Hint */}
            <div className="text-center py-4 border-t border-zinc-900">
                <p className="text-[10px] text-zinc-600">
                    Drag a signature onto a document to place it
                </p>
            </div>
        </div>
    );
}
