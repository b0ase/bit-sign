'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { FiX, FiMove, FiMaximize2, FiType, FiTrash2, FiEdit3, FiPenTool, FiCalendar, FiMail } from 'react-icons/fi';
import SovereignSignature from '@/components/SovereignSignature';

export interface PlacedElement {
    id: string;
    type: 'signature' | 'text';
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    // Signature-specific
    signatureId?: string;
    signatureSvg?: string;
    signaturePreviewUrl?: string;
    // Text-specific
    text?: string;
    fontSize?: number;
    fontFamily?: string;
}

interface DocumentCanvasProps {
    documentUrl: string;
    documentId: string;
    signerHandle?: string;
    originalFileName?: string;
    elements: PlacedElement[];
    onElementsChange: (elements: PlacedElement[]) => void;
    onSeal: (compositeBase64: string, elements: PlacedElement[]) => void;
    onClose: () => void;
    onEmailRecipients?: () => void;
    onSaveSignature?: (signatureData: { svg: string; json: string }) => Promise<string | null>;
    pageCount?: number;
}

export default function DocumentCanvas({
    documentUrl,
    documentId,
    signerHandle,
    originalFileName,
    elements,
    onElementsChange,
    onSeal,
    onClose,
    onEmailRecipients,
    onSaveSignature,
    pageCount = 1,
}: DocumentCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [docLoaded, setDocLoaded] = useState(false);
    const [docError, setDocError] = useState(false);
    const [compositing, setCompositing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    // Keep a ref to latest elements so async callbacks don't use stale closures
    const elementsRef = useRef(elements);
    elementsRef.current = elements;

    // Drag/resize state
    const dragRef = useRef<{
        elementId: string;
        startX: number;
        startY: number;
        startEl: PlacedElement;
        mode: 'move' | 'resize';
    } | null>(null);

    // Generate unique ID
    const genId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Drop handler — accept dragged signatures from SignatureExplorer
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        const container = containerRef.current;
        if (!container) return;

        let data: any;
        try {
            data = JSON.parse(e.dataTransfer.getData('application/json'));
        } catch {
            return;
        }

        if (!data.signatureId) return;

        const rect = container.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;

        // Size signature relative to a single page, not the entire document
        const sigWidthPct = 25;
        const sigHeightPct = Math.min(15, 12 / pageCount);

        const newElement: PlacedElement = {
            id: genId(),
            type: 'signature',
            xPct: Math.max(0, Math.min(100 - sigWidthPct, xPct - sigWidthPct / 2)),
            yPct: Math.max(0, Math.min(100 - sigHeightPct, yPct - sigHeightPct / 2)),
            widthPct: sigWidthPct,
            heightPct: sigHeightPct,
            signatureId: data.signatureId,
            signaturePreviewUrl: data.previewUrl || undefined,
        };

        // If it's a TLDRAW signature, fetch SVG for compositing
        if (data.signatureType === 'TLDRAW' && data.previewUrl) {
            fetchSignatureSvg(data.signatureId).then(svg => {
                if (svg) {
                    onElementsChange(elementsRef.current.map(el =>
                        el.id === newElement.id ? { ...el, signatureSvg: svg } : el
                    ));
                }
            });
        }

        onElementsChange([...elements, newElement]);
        setSelectedId(newElement.id);
    }, [elements, onElementsChange, pageCount]);

    const fetchSignatureSvg = async (sigId: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/bitsign/signatures/${sigId}/preview`);
            if (!res.ok) return null;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('svg')) {
                return await res.text();
            }
            return null;
        } catch {
            return null;
        }
    };

    // Handle drawn signature from SovereignSignature modal
    const handleDrawnSignature = useCallback(async (signatureData: { svg: string; json: string }) => {
        const svgB64 = btoa(unescape(encodeURIComponent(signatureData.svg)));
        const previewUrl = `data:image/svg+xml;base64,${svgB64}`;

        // Save to vault if callback provided
        let savedId: string | null = null;
        if (onSaveSignature) {
            savedId = await onSaveSignature(signatureData);
        }

        // Size signature relative to a single page
        const drawnHeightPct = Math.min(10, 8 / pageCount);

        const newElement: PlacedElement = {
            id: genId(),
            type: 'signature',
            xPct: 20,
            yPct: 2 / pageCount,
            widthPct: 30,
            heightPct: drawnHeightPct,
            signatureId: savedId || undefined,
            signatureSvg: signatureData.svg,
            signaturePreviewUrl: previewUrl,
        };
        onElementsChange([...elements, newElement]);
        setSelectedId(newElement.id);
        setShowSignatureModal(false);
    }, [elements, onElementsChange, onSaveSignature, pageCount]);

    // Add text element
    const addTextElement = useCallback(() => {
        const newElement: PlacedElement = {
            id: genId(),
            type: 'text',
            xPct: 30,
            yPct: 2 / pageCount,
            widthPct: 40,
            heightPct: Math.min(8, 6 / pageCount),
            text: 'Type here...',
            fontSize: 16,
            fontFamily: 'sans-serif',
        };
        onElementsChange([...elements, newElement]);
        setSelectedId(newElement.id);
        setEditingTextId(newElement.id);
    }, [elements, onElementsChange, pageCount]);

    // Add date element
    const addDateElement = useCallback(() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const newElement: PlacedElement = {
            id: genId(),
            type: 'text',
            xPct: 55,
            yPct: 2 / pageCount,
            widthPct: 20,
            heightPct: Math.min(5, 4 / pageCount),
            text: dateStr,
            fontSize: 14,
            fontFamily: 'sans-serif',
        };
        onElementsChange([...elements, newElement]);
        setSelectedId(newElement.id);
    }, [elements, onElementsChange, pageCount]);

    // Delete selected element
    const deleteElement = useCallback((id: string) => {
        onElementsChange(elements.filter(el => el.id !== id));
        if (selectedId === id) setSelectedId(null);
        if (editingTextId === id) setEditingTextId(null);
    }, [elements, onElementsChange, selectedId, editingTextId]);

    // Pointer-based move/resize (same approach as DocumentSigner)
    const handlePointerDown = useCallback((e: React.PointerEvent, elementId: string, mode: 'move' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const el = elements.find(el => el.id === elementId);
        if (!el) return;

        dragRef.current = {
            elementId,
            startX: e.clientX,
            startY: e.clientY,
            startEl: { ...el },
            mode,
        };
        setSelectedId(elementId);
    }, [elements]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current || !containerRef.current) return;
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
        const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
        const s = dragRef.current.startEl;

        if (dragRef.current.mode === 'move') {
            const updated = elements.map(el =>
                el.id === dragRef.current!.elementId
                    ? {
                        ...el,
                        xPct: Math.max(0, Math.min(100 - s.widthPct, s.xPct + dx)),
                        yPct: Math.max(0, Math.min(100 - s.heightPct, s.yPct + dy)),
                    }
                    : el
            );
            onElementsChange(updated);
        } else {
            // Free resize: width follows horizontal drag, height follows vertical drag
            // This works correctly regardless of page count since both axes are independent
            const maxH = Math.min(80, 100 / pageCount);
            const newW = Math.max(5, Math.min(80, s.widthPct + dx));
            const newH = Math.max(2, Math.min(maxH, s.heightPct + dy));
            const updated = elements.map(el =>
                el.id === dragRef.current!.elementId
                    ? { ...el, widthPct: newW, heightPct: newH }
                    : el
            );
            onElementsChange(updated);
        }
    }, [elements, onElementsChange, pageCount]);

    const handlePointerUp = useCallback(() => {
        dragRef.current = null;
    }, []);

    // Click on canvas background deselects
    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
            setSelectedId(null);
            setEditingTextId(null);
        }
    }, []);

    // Update text content
    const updateText = useCallback((id: string, text: string) => {
        onElementsChange(elements.map(el =>
            el.id === id ? { ...el, text } : el
        ));
    }, [elements, onElementsChange]);

    // Canvas compositing for seal
    const handleSeal = useCallback(async () => {
        if (!containerRef.current) return;
        setCompositing(true);

        try {
            // Load document image
            const docImg = new Image();
            docImg.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                docImg.onload = () => resolve();
                docImg.onerror = () => reject(new Error('Failed to load document'));
                docImg.src = documentUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = docImg.naturalWidth;
            canvas.height = docImg.naturalHeight;
            const ctx = canvas.getContext('2d')!;

            // Draw document
            ctx.drawImage(docImg, 0, 0);

            // Draw each element in order
            for (const el of elements) {
                const x = (el.xPct / 100) * canvas.width;
                const y = (el.yPct / 100) * canvas.height;
                const w = (el.widthPct / 100) * canvas.width;
                const h = (el.heightPct / 100) * canvas.height;

                if (el.type === 'signature') {
                    // Try SVG first, then preview URL
                    let sigImg: HTMLImageElement | null = null;

                    if (el.signatureSvg) {
                        const svgB64 = btoa(unescape(encodeURIComponent(el.signatureSvg)));
                        sigImg = new Image();
                        await new Promise<void>((resolve) => {
                            sigImg!.onload = () => resolve();
                            sigImg!.onerror = () => { sigImg = null; resolve(); };
                            sigImg!.src = `data:image/svg+xml;base64,${svgB64}`;
                        });
                    }

                    if (!sigImg && el.signaturePreviewUrl) {
                        sigImg = new Image();
                        sigImg.crossOrigin = 'anonymous';
                        await new Promise<void>((resolve) => {
                            sigImg!.onload = () => resolve();
                            sigImg!.onerror = () => { sigImg = null; resolve(); };
                            sigImg!.src = el.signaturePreviewUrl!;
                        });
                    }

                    if (sigImg) {
                        ctx.drawImage(sigImg, x, y, w, h);
                    }
                } else if (el.type === 'text' && el.text) {
                    const fontSize = Math.round((el.fontSize || 16) * (canvas.width / 800));
                    ctx.font = `${fontSize}px ${el.fontFamily || 'sans-serif'}`;
                    ctx.fillStyle = '#000000';
                    ctx.textBaseline = 'top';

                    // Word wrap
                    const words = el.text.split(' ');
                    let line = '';
                    let lineY = y + 4;
                    const maxWidth = w - 8;

                    for (const word of words) {
                        const test = line + (line ? ' ' : '') + word;
                        if (ctx.measureText(test).width > maxWidth && line) {
                            ctx.fillText(line, x + 4, lineY);
                            line = word;
                            lineY += fontSize * 1.3;
                        } else {
                            line = test;
                        }
                    }
                    if (line) {
                        ctx.fillText(line, x + 4, lineY);
                    }
                }
            }

            // Draw seal stamp at bottom-right
            const stampPad = Math.round(canvas.width * 0.02);
            const stampFontSize = Math.max(12, Math.round(canvas.width * 0.014));
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toTimeString().slice(0, 5);
            const line1 = `SEALED by $${signerHandle || 'unknown'}`;
            const line2 = `${dateStr} ${timeStr} UTC`;
            const docNameLine = originalFileName ? `"${originalFileName}"` : null;
            const line3 = 'BIT-SIGN PROTOCOL';

            ctx.font = `bold ${stampFontSize}px monospace`;
            const stampLines = [line1, line2, ...(docNameLine ? [docNameLine] : []), line3];
            const maxLineWidth = Math.max(...stampLines.map(l => ctx.measureText(l).width));
            const boxW = maxLineWidth + stampPad * 3;
            const boxH = stampFontSize * stampLines.length * 1.4 + stampPad * 2;
            const boxX = canvas.width - boxW - stampPad * 2;
            const boxY = canvas.height - boxH - stampPad * 2;

            // Stamp background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            // Stamp text
            let lineIdx = 0;
            ctx.fillStyle = '#f59e0b';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${stampFontSize}px monospace`;
            ctx.fillText(line1, boxX + stampPad * 1.5, boxY + stampPad + stampFontSize * 1.4 * lineIdx);
            lineIdx++;
            ctx.fillStyle = '#d4d4d8';
            ctx.font = `${stampFontSize}px monospace`;
            ctx.fillText(line2, boxX + stampPad * 1.5, boxY + stampPad + stampFontSize * 1.4 * lineIdx);
            lineIdx++;
            if (docNameLine) {
                ctx.fillStyle = '#a1a1aa';
                ctx.font = `${stampFontSize}px monospace`;
                ctx.fillText(docNameLine, boxX + stampPad * 1.5, boxY + stampPad + stampFontSize * 1.4 * lineIdx);
                lineIdx++;
            }
            ctx.fillStyle = '#71717a';
            ctx.font = `${Math.round(stampFontSize * 0.85)}px monospace`;
            ctx.fillText(line3, boxX + stampPad * 1.5, boxY + stampPad + stampFontSize * 1.4 * lineIdx);

            const compositeBase64 = canvas.toDataURL('image/png');
            onSeal(compositeBase64, elements);
        } catch (error) {
            console.error('Compositing failed:', error);
            alert('Failed to create sealed document. Please try again.');
        } finally {
            setCompositing(false);
        }
    }, [documentUrl, elements, onSeal, signerHandle, originalFileName]);

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (documentUrl.startsWith('blob:')) {
                URL.revokeObjectURL(documentUrl);
            }
        };
    }, [documentUrl]);

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSignatureModal(true)}
                        className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs rounded-md hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-1.5"
                    >
                        <FiPenTool size={12} /> Draw Signature
                    </button>
                    <button
                        onClick={addTextElement}
                        className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs rounded-md hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-1.5"
                    >
                        <FiType size={12} /> Add Text
                    </button>
                    <button
                        onClick={addDateElement}
                        className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs rounded-md hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-1.5"
                    >
                        <FiCalendar size={12} /> Add Date
                    </button>
                    {onEmailRecipients && (
                        <button
                            onClick={onEmailRecipients}
                            className="px-3 py-1.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs rounded-md hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-1.5"
                        >
                            <FiMail size={12} /> Email Recipients
                        </button>
                    )}
                    {selectedId && (
                        <button
                            onClick={() => deleteElement(selectedId)}
                            className="px-3 py-1.5 border border-red-900/40 bg-zinc-900 text-red-400 text-xs rounded-md hover:bg-red-950 transition-all flex items-center gap-1.5"
                        >
                            <FiTrash2 size={12} /> Delete
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSeal}
                        disabled={compositing || !docLoaded || elements.length === 0}
                        className="px-4 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {compositing ? (
                            <>
                                <div className="w-3 h-3 border-t-2 border-black animate-spin rounded-full" />
                                Sealing...
                            </>
                        ) : (
                            'Seal'
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                    >
                        <FiX size={16} />
                    </button>
                </div>
            </div>

            {/* Canvas area */}
            <div className="flex-1 overflow-auto p-4">
                <div
                    ref={containerRef}
                    className={`relative max-w-3xl mx-auto select-none transition-all ${
                        dragOver ? 'ring-2 ring-green-500/50 ring-offset-2 ring-offset-black' : ''
                    }`}
                    style={{ touchAction: 'none' }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={handleBackgroundClick}
                >
                    {/* Document image */}
                    {docError ? (
                        <div className="w-full py-24 flex flex-col items-center justify-center text-center bg-zinc-900 rounded-md">
                            <FiX className="text-red-500 text-2xl mb-3" />
                            <p className="text-sm text-zinc-400">Unable to display this document</p>
                            <p className="text-xs text-zinc-600 mt-1">Only image files (PNG, JPEG) and PDFs are supported in the workspace.</p>
                        </div>
                    ) : (
                        <img
                            src={documentUrl}
                            alt="Document"
                            className="w-full h-auto rounded-md shadow-2xl"
                            onLoad={() => setDocLoaded(true)}
                            onError={() => { setDocError(true); setDocLoaded(true); }}
                            draggable={false}
                        />
                    )}

                    {/* Drop overlay */}
                    {dragOver && (
                        <div className="absolute inset-0 bg-green-500/10 border-2 border-dashed border-green-500/40 rounded-md flex items-center justify-center pointer-events-none">
                            <span className="text-green-400 text-sm font-medium bg-black/80 px-3 py-1.5 rounded">Drop signature here</span>
                        </div>
                    )}

                    {/* Placed elements */}
                    {docLoaded && elements.map(el => {
                        const isSelected = el.id === selectedId;
                        const isEditingText = el.id === editingTextId;

                        return (
                            <div
                                key={el.id}
                                className={`absolute group ${
                                    isSelected
                                        ? 'border-2 border-green-500/80 bg-green-500/5'
                                        : 'border border-dashed border-transparent hover:border-zinc-500/40'
                                }`}
                                style={{
                                    left: `${el.xPct}%`,
                                    top: `${el.yPct}%`,
                                    width: `${el.widthPct}%`,
                                    height: `${el.heightPct}%`,
                                }}
                                onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                            >
                                {el.type === 'signature' ? (
                                    <>
                                        {/* Signature image */}
                                        {el.signaturePreviewUrl ? (
                                            <img
                                                src={el.signaturePreviewUrl}
                                                alt="Signature"
                                                className="w-full h-full object-contain pointer-events-none"
                                                draggable={false}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                                <FiEdit3 size={16} />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Text element */}
                                        {isEditingText ? (
                                            <textarea
                                                value={el.text || ''}
                                                onChange={(e) => updateText(el.id, e.target.value)}
                                                onBlur={() => setEditingTextId(null)}
                                                autoFocus
                                                className="w-full h-full bg-transparent text-black resize-none border-none outline-none p-1"
                                                style={{
                                                    fontSize: `${el.fontSize || 16}px`,
                                                    fontFamily: el.fontFamily || 'sans-serif',
                                                }}
                                            />
                                        ) : (
                                            <div
                                                onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(el.id); }}
                                                className="w-full h-full p-1 cursor-text overflow-hidden"
                                                style={{
                                                    fontSize: `${el.fontSize || 16}px`,
                                                    fontFamily: el.fontFamily || 'sans-serif',
                                                    color: '#000000',
                                                }}
                                            >
                                                {el.text || 'Double-click to edit'}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Move handle — visible on select/hover */}
                                {isSelected && (
                                    <>
                                        <div
                                            className="absolute inset-0 cursor-move"
                                            onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}
                                        />
                                        <div className="absolute top-0.5 left-0.5 p-0.5 bg-black/70 rounded text-green-400 pointer-events-none">
                                            <FiMove size={10} />
                                        </div>
                                        {/* Resize handle — bottom-right */}
                                        <div
                                            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-green-500 border-2 border-black rounded-sm cursor-nwse-resize flex items-center justify-center z-10"
                                            onPointerDown={(e) => handlePointerDown(e, el.id, 'resize')}
                                        >
                                            <FiMaximize2 size={8} className="text-black" />
                                        </div>
                                        {/* Delete button — top-right */}
                                        <button
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center z-10 hover:bg-red-500 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                        >
                                            <FiX size={10} className="text-white" />
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {/* Empty state hint */}
                    {docLoaded && elements.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/70 backdrop-blur-sm text-center px-6 py-4 rounded-lg border border-zinc-700/50">
                                <p className="text-sm text-zinc-300">
                                    Drag a signature from the left panel onto this document
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">Or use <span className="text-zinc-400">Draw Signature</span> / <span className="text-zinc-400">Add Text</span> above</p>
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {!docLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full opacity-20" />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-zinc-800 text-center shrink-0">
                <p className="text-[10px] text-zinc-600">
                    Drag signatures from the left panel. Click to select, drag to move, corner to resize. Double-click text to edit.
                </p>
            </div>

            {/* SovereignSignature modal for drawing */}
            {showSignatureModal && (
                <SovereignSignature
                    onSave={handleDrawnSignature}
                    onCancel={() => setShowSignatureModal(false)}
                />
            )}
        </div>
    );
}
