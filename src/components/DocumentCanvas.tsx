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
    signerName?: string;
    signerIdentities?: string[];
    originalFileName?: string;
    existingSealCount?: number;
    elements: PlacedElement[];
    onElementsChange: (elements: PlacedElement[]) => void;
    onSeal: (compositeBase64: string, elements: PlacedElement[]) => void;
    onClose: () => void;
    onEmailRecipients?: () => void;
    onSaveSignature?: (signatureData: { svg: string; json: string }) => Promise<string | null>;
    pageCount?: number;
    onEffectivePagesDetected?: (pages: number) => void;
}

export default function DocumentCanvas({
    documentUrl,
    documentId,
    signerHandle,
    signerName,
    signerIdentities = [],
    originalFileName,
    existingSealCount = 0,
    elements,
    onElementsChange,
    onSeal,
    onClose,
    onEmailRecipients,
    onSaveSignature,
    pageCount = 1,
    onEffectivePagesDetected,
}: DocumentCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [docLoaded, setDocLoaded] = useState(false);
    const [docError, setDocError] = useState(false);
    const [compositing, setCompositing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [effectivePages, setEffectivePages] = useState(pageCount);

    // Fixed pixel targets — signatures are always this size on screen
    const SIG_HEIGHT_PX = 60;
    const SIG_WIDTH_PX = 150;
    const TEXT_HEIGHT_PX = 40;
    const DATE_HEIGHT_PX = 28;

    // Ref storing the rendered image height for pct conversion
    const renderedHeightRef = useRef<number>(0);
    const renderedWidthRef = useRef<number>(0);

    // Convert fixed pixels to percentage of the rendered image
    const pxToHeightPct = (px: number) => {
        if (renderedHeightRef.current <= 0) return 6; // safe fallback
        return (px / renderedHeightRef.current) * 100;
    };
    const pxToWidthPct = (px: number) => {
        if (renderedWidthRef.current <= 0) return 20;
        return (px / renderedWidthRef.current) * 100;
    };

    // Keep a ref to latest elements so async callbacks don't use stale closures
    const elementsRef = useRef(elements);
    elementsRef.current = elements;

    // Auto-clamp: when image dimensions are known, fix any oversized elements
    useEffect(() => {
        if (renderedHeightRef.current <= 0) return;
        const maxH = pxToHeightPct(SIG_HEIGHT_PX) * 1.5; // allow some tolerance
        const oversized = elementsRef.current.filter(
            el => el.type === 'signature' && el.heightPct > maxH
        );
        if (oversized.length > 0) {
            const targetH = pxToHeightPct(SIG_HEIGHT_PX);
            const targetW = pxToWidthPct(SIG_WIDTH_PX);
            onElementsChange(elementsRef.current.map(el =>
                el.type === 'signature' && el.heightPct > maxH
                    ? { ...el, heightPct: targetH, widthPct: Math.min(el.widthPct, targetW) }
                    : el
            ));
        }
    }, [effectivePages, docLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // Fixed pixel size — always the same visual size regardless of document
        const sigWidthPct = pxToWidthPct(SIG_WIDTH_PX);
        const sigHeightPct = pxToHeightPct(SIG_HEIGHT_PX);

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
    }, [elements, onElementsChange, docLoaded]);

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
        // Close modal immediately to prevent duplicate saves
        setShowSignatureModal(false);

        const svgB64 = btoa(unescape(encodeURIComponent(signatureData.svg)));
        const previewUrl = `data:image/svg+xml;base64,${svgB64}`;

        // Fixed pixel size — same visual size regardless of document
        const drawnHeightPct = pxToHeightPct(SIG_HEIGHT_PX);
        const drawnWidthPct = pxToWidthPct(SIG_WIDTH_PX);

        const elementId = genId();
        const newElement: PlacedElement = {
            id: elementId,
            type: 'signature',
            xPct: 20,
            yPct: pxToHeightPct(20),
            widthPct: drawnWidthPct,
            heightPct: drawnHeightPct,
            signatureSvg: signatureData.svg,
            signaturePreviewUrl: previewUrl,
        };
        onElementsChange([...elements, newElement]);
        setSelectedId(elementId);

        // Save to vault in background, update element with saved ID
        if (onSaveSignature) {
            const savedId = await onSaveSignature(signatureData);
            if (savedId) {
                onElementsChange(elementsRef.current.map(el =>
                    el.id === elementId ? { ...el, signatureId: savedId } : el
                ));
            }
        }
    }, [elements, onElementsChange, onSaveSignature, docLoaded]);

    // Add text element — centered in the visible viewport
    const addTextElement = useCallback(() => {
        // Find the scroll container and compute visible center in document %
        const scrollParent = containerRef.current?.closest('.overflow-auto');
        const container = containerRef.current;
        let centerYPct = 50; // default to middle of document
        if (scrollParent && container) {
            const containerRect = container.getBoundingClientRect();
            const scrollRect = scrollParent.getBoundingClientRect();
            // Visible center relative to the container
            const visibleCenterY = (scrollRect.top + scrollRect.height / 2) - containerRect.top;
            centerYPct = Math.max(5, Math.min(90, (visibleCenterY / containerRect.height) * 100));
        }

        const newElement: PlacedElement = {
            id: genId(),
            type: 'text',
            xPct: 30,
            yPct: centerYPct - pxToHeightPct(TEXT_HEIGHT_PX) / 2,
            widthPct: 40,
            heightPct: pxToHeightPct(TEXT_HEIGHT_PX),
            text: 'Type here...',
            fontSize: 16,
            fontFamily: 'sans-serif',
        };
        onElementsChange([...elements, newElement]);
        setSelectedId(newElement.id);
        setEditingTextId(newElement.id);
    }, [elements, onElementsChange, docLoaded]);

    // Add date element — centered in the visible viewport
    const addDateElement = useCallback(() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const scrollParent = containerRef.current?.closest('.overflow-auto');
        const container = containerRef.current;
        let centerYPct = 50;
        if (scrollParent && container) {
            const containerRect = container.getBoundingClientRect();
            const scrollRect = scrollParent.getBoundingClientRect();
            const visibleCenterY = (scrollRect.top + scrollRect.height / 2) - containerRect.top;
            centerYPct = Math.max(5, Math.min(90, (visibleCenterY / containerRect.height) * 100));
        }

        const newElement: PlacedElement = {
            id: genId(),
            type: 'text',
            xPct: 55,
            yPct: centerYPct - pxToHeightPct(DATE_HEIGHT_PX) / 2,
            widthPct: 20,
            heightPct: pxToHeightPct(DATE_HEIGHT_PX),
            text: dateStr,
            fontSize: 14,
            fontFamily: 'sans-serif',
        };
        onElementsChange([...elements, newElement]);
        setSelectedId(newElement.id);
    }, [elements, onElementsChange, docLoaded]);

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
            // Free resize — cap at 200px equivalent so user can't make it huge
            const maxH = pxToHeightPct(200);
            const newW = Math.max(5, Math.min(60, s.widthPct + dx));
            const newH = Math.max(1, Math.min(maxH, s.heightPct + dy));
            const updated = elements.map(el =>
                el.id === dragRef.current!.elementId
                    ? { ...el, widthPct: newW, heightPct: newH }
                    : el
            );
            onElementsChange(updated);
        }
    }, [elements, onElementsChange, docLoaded]);

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
                } else if (el.type === 'text' && el.text && el.text !== 'Type here...') {
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

            // === BORDERED SHEET WITH SEAL ===
            // Place the signed document on a larger sheet with borders.
            // The seal stamp goes on the border, not on the document itself.

            const stampFontSize = Math.max(14, Math.round(docImg.naturalWidth * 0.016));
            const smallFont = Math.round(stampFontSize * 0.85);
            const lineHeight = stampFontSize * 1.5;
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toTimeString().slice(0, 5);

            // Build stamp lines
            const stampLines: { text: string; color: string; bold?: boolean }[] = [];
            stampLines.push({ text: `SEALED by $${signerHandle || 'unknown'}`, color: '#f59e0b', bold: true });
            if (signerName) {
                stampLines.push({ text: signerName, color: '#e4e4e7' });
            }
            for (const id of signerIdentities) {
                stampLines.push({ text: id, color: '#a1a1aa' });
            }
            stampLines.push({ text: `${dateStr} ${timeStr} UTC`, color: '#d4d4d8' });
            // TXID line is left blank — the server burns the real TXID here after chain inscription
            stampLines.push({ text: '', color: 'transparent' });
            stampLines.push({ text: 'bit-sign.online', color: '#52525b' });

            // Calculate border and sheet dimensions
            const borderWidth = Math.round(docImg.naturalWidth * 0.04);
            const stampAreaHeight = lineHeight * stampLines.length + borderWidth * 2;
            const sheetW = docImg.naturalWidth + borderWidth * 2;
            const sheetH = docImg.naturalHeight + borderWidth + stampAreaHeight;

            // Create the bordered sheet canvas
            const sheetCanvas = document.createElement('canvas');
            sheetCanvas.width = sheetW;
            sheetCanvas.height = sheetH;
            const sheetCtx = sheetCanvas.getContext('2d')!;

            // Sheet background (dark)
            sheetCtx.fillStyle = '#18181b';
            sheetCtx.fillRect(0, 0, sheetW, sheetH);

            // Border line around document area
            sheetCtx.strokeStyle = '#3f3f46';
            sheetCtx.lineWidth = 2;
            sheetCtx.strokeRect(borderWidth - 1, borderWidth - 1, docImg.naturalWidth + 2, docImg.naturalHeight + 2);

            // Place the signed document (from the first canvas) inside the border
            sheetCtx.drawImage(canvas, borderWidth, borderWidth);

            // Draw amber accent line separating document from seal area
            const sealY = borderWidth + docImg.naturalHeight + Math.round(borderWidth * 0.5);
            sheetCtx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
            sheetCtx.lineWidth = 2;
            sheetCtx.beginPath();
            sheetCtx.moveTo(borderWidth, sealY);
            sheetCtx.lineTo(sheetW - borderWidth, sealY);
            sheetCtx.stroke();

            // Draw seal stamp text in the border area below the document
            sheetCtx.textBaseline = 'top';
            const stampTextX = borderWidth + Math.round(borderWidth * 0.5);
            const stampStartY = sealY + Math.round(borderWidth * 0.5);

            stampLines.forEach((line, idx) => {
                sheetCtx.fillStyle = line.color;
                sheetCtx.font = `${line.bold ? 'bold ' : ''}${idx === stampLines.length - 1 ? smallFont : stampFontSize}px monospace`;
                sheetCtx.fillText(line.text, stampTextX, stampStartY + lineHeight * idx);
            });

            // bit-sign.online branding — right-aligned
            sheetCtx.fillStyle = '#3f3f46';
            sheetCtx.font = `${smallFont}px monospace`;
            const brandText = 'bit-sign.online';
            const brandWidth = sheetCtx.measureText(brandText).width;
            sheetCtx.fillText(brandText, sheetW - borderWidth - brandWidth - Math.round(borderWidth * 0.5), stampStartY);

            // Use JPEG for multi-page docs to stay under Vercel's 4.5MB body limit
            const totalPixels = sheetW * sheetH;
            const useJpeg = effectivePages > 1 || totalPixels > 4_000_000;
            const mimeType = useJpeg ? 'image/jpeg' : 'image/png';
            const quality = useJpeg ? 0.82 : undefined;
            const compositeBase64 = sheetCanvas.toDataURL(mimeType, quality);
            onSeal(compositeBase64, elements);
        } catch (error) {
            console.error('Compositing failed:', error);
            alert('Failed to create sealed document. Please try again.');
        } finally {
            setCompositing(false);
        }
    }, [documentUrl, elements, onSeal, signerHandle, signerName, signerIdentities, originalFileName, existingSealCount]);

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
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-500 transition-all flex items-center gap-1.5"
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
                            ref={imgRef}
                            src={documentUrl}
                            alt="Document"
                            className="w-full h-auto rounded-md shadow-2xl"
                            onLoad={(e) => {
                                const img = e.currentTarget;
                                // Store rendered dimensions for fixed-pixel → percentage conversion
                                const containerW = containerRef.current?.getBoundingClientRect().width || 768;
                                const renderedH = containerW * (img.naturalHeight / img.naturalWidth);
                                renderedWidthRef.current = containerW;
                                renderedHeightRef.current = renderedH;

                                // Detect effective page count from aspect ratio
                                const ratio = img.naturalHeight / img.naturalWidth;
                                const estimated = Math.max(1, Math.round(ratio / 1.41));
                                const detected = Math.max(pageCount, estimated);
                                setEffectivePages(detected);
                                if (detected !== pageCount && onEffectivePagesDetected) {
                                    onEffectivePagesDetected(detected);
                                }

                                setDocLoaded(true);
                            }}
                            onError={() => { setDocError(true); setDocLoaded(true); }}
                            draggable={false}
                        />
                    )}

                    {/* Hint overlay — show when doc loaded but no elements placed */}
                    {docLoaded && elements.length === 0 && !dragOver && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/80 border border-zinc-700 rounded-lg px-5 py-3 text-center">
                                <p className="text-sm text-zinc-300">Click <span className="text-white font-medium">Draw Signature</span> to place your signature</p>
                                <p className="text-xs text-zinc-500 mt-1">or drag an existing signature from your vault</p>
                            </div>
                        </div>
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
                                                ref={(textarea) => {
                                                    if (textarea) {
                                                        textarea.focus();
                                                        // If it's the placeholder, select all so typing replaces it
                                                        if (el.text === 'Type here...') {
                                                            textarea.select();
                                                        }
                                                    }
                                                }}
                                                value={el.text || ''}
                                                onChange={(e) => updateText(el.id, e.target.value)}
                                                onBlur={() => setEditingTextId(null)}
                                                onKeyDown={(e) => {
                                                    // On first keystroke with placeholder, clear and replace
                                                    if (el.text === 'Type here...' && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                                                        e.preventDefault();
                                                        updateText(el.id, e.key);
                                                        // Move cursor to end after replacing
                                                        const ta = e.currentTarget;
                                                        setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.value.length; }, 0);
                                                    }
                                                }}
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
                                                    color: el.text === 'Type here...' ? '#9ca3af' : '#000000',
                                                }}
                                            >
                                                {el.text || 'Double-click to edit'}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Move handle — visible on select/hover (hidden when editing text) */}
                                {isSelected && (
                                    <>
                                        {!isEditingText && (
                                            <div
                                                className="absolute inset-0 cursor-move"
                                                onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}
                                            />
                                        )}
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
