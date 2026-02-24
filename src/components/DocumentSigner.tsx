'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { FiX, FiMove, FiMaximize2 } from 'react-icons/fi';

export interface SignaturePlacement {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

interface DocumentSignerProps {
  documentUrl: string;
  signatureSvg: string;
  onSeal: (compositeBase64: string, placement: SignaturePlacement) => void;
  onCancel: () => void;
}

export default function DocumentSigner({ documentUrl, signatureSvg, onSeal, onCancel }: DocumentSignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [compositing, setCompositing] = useState(false);

  // Signature placement as percentages of document dimensions
  const [placement, setPlacement] = useState<SignaturePlacement>({
    xPct: 55,
    yPct: 75,
    widthPct: 30,
    heightPct: 15,
  });

  // Drag state
  const dragRef = useRef<{ startX: number; startY: number; startPct: SignaturePlacement; mode: 'move' | 'resize' } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPct: { ...placement },
      mode,
    };
  }, [placement]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    const s = dragRef.current.startPct;

    if (dragRef.current.mode === 'move') {
      setPlacement({
        ...s,
        xPct: Math.max(0, Math.min(100 - s.widthPct, s.xPct + dx)),
        yPct: Math.max(0, Math.min(100 - s.heightPct, s.yPct + dy)),
      });
    } else {
      // Resize — proportional
      const aspect = s.widthPct / s.heightPct;
      const newW = Math.max(10, Math.min(80, s.widthPct + dx));
      const newH = newW / aspect;
      setPlacement({
        ...s,
        widthPct: newW,
        heightPct: Math.max(5, Math.min(60, newH)),
      });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

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

      // Load signature SVG
      const svgB64 = btoa(unescape(encodeURIComponent(signatureSvg)));
      const sigImg = new Image();
      await new Promise<void>((resolve, reject) => {
        sigImg.onload = () => resolve();
        sigImg.onerror = () => reject(new Error('Failed to load signature'));
        sigImg.src = `data:image/svg+xml;base64,${svgB64}`;
      });

      // Composite on offscreen canvas at document's native resolution
      const canvas = document.createElement('canvas');
      canvas.width = docImg.naturalWidth;
      canvas.height = docImg.naturalHeight;
      const ctx = canvas.getContext('2d')!;

      // Draw document
      ctx.drawImage(docImg, 0, 0);

      // Draw signature at placement position
      const sigX = (placement.xPct / 100) * canvas.width;
      const sigY = (placement.yPct / 100) * canvas.height;
      const sigW = (placement.widthPct / 100) * canvas.width;
      const sigH = (placement.heightPct / 100) * canvas.height;

      ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);

      const compositeBase64 = canvas.toDataURL('image/png');
      onSeal(compositeBase64, placement);
    } catch (error) {
      console.error('Compositing failed:', error);
      alert('Failed to create sealed document. Please try again.');
    } finally {
      setCompositing(false);
    }
  }, [documentUrl, signatureSvg, placement, onSeal]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (documentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [documentUrl]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <h2 className="text-sm font-medium text-white">Place Signature on Document</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeal}
            disabled={compositing || !docLoaded}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {compositing ? (
              <>
                <div className="w-4 h-4 border-t-2 border-black animate-spin rounded-full" />
                Sealing...
              </>
            ) : (
              'Seal with HandCash ($0.01)'
            )}
          </button>
          <button
            onClick={onCancel}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>
      </div>

      {/* Document area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6">
        <div
          ref={containerRef}
          className="relative max-w-3xl w-full select-none"
          style={{ touchAction: 'none' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Document image */}
          <img
            src={documentUrl}
            alt="Document"
            className="w-full h-auto rounded-md shadow-2xl"
            onLoad={() => setDocLoaded(true)}
            draggable={false}
          />

          {/* Signature overlay */}
          {docLoaded && (
            <div
              className="absolute border-2 border-dashed border-green-500/60 bg-green-500/5 cursor-move group"
              style={{
                left: `${placement.xPct}%`,
                top: `${placement.yPct}%`,
                width: `${placement.widthPct}%`,
                height: `${placement.heightPct}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              {/* Signature image */}
              <img
                src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(signatureSvg)))}`}
                alt="Signature"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Move indicator */}
              <div className="absolute top-1 left-1 p-1 bg-black/70 rounded text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <FiMove size={12} />
              </div>

              {/* Resize handle — bottom-right corner */}
              <div
                className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-green-500 border-2 border-black rounded-sm cursor-nwse-resize flex items-center justify-center"
                onPointerDown={(e) => handlePointerDown(e, 'resize')}
              >
                <FiMaximize2 size={10} className="text-black" />
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
      <div className="px-6 py-3 border-t border-zinc-900 text-center">
        <p className="text-xs text-zinc-600">
          Drag to position, resize from corner. The signed document will be inscribed on-chain.
        </p>
      </div>
    </div>
  );
}
