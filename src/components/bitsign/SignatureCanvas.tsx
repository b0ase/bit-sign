'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface SignatureCanvasProps {
  onSignatureChange?: (svg: string | null, thumbnail: string | null) => void;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  disabled?: boolean;
}

export function SignatureCanvas({
  onSignatureChange,
  width = 500,
  height = 200,
  strokeColor = '#000000',
  strokeWidth = 3,
  backgroundColor = '#ffffff',
  disabled = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [hasSignature, setHasSignature] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear with background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }, [width, height, backgroundColor]);

  // Redraw canvas when paths change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw all paths
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    [...paths, currentPath].forEach((path) => {
      if (path.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);

      for (let i = 1; i < path.length; i++) {
        const p0 = path[i - 1];
        const p1 = path[i];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }

      ctx.stroke();
    });
  }, [paths, currentPath, strokeColor, strokeWidth, backgroundColor, width, height]);

  // Generate SVG from paths
  const generateSVG = useCallback(() => {
    if (paths.length === 0) return null;

    const pathStrings = paths.map((path) => {
      if (path.length < 2) return '';

      let d = `M ${path[0].x} ${path[0].y}`;
      for (let i = 1; i < path.length; i++) {
        const p0 = path[i - 1];
        const p1 = path[i];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        d += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
      }
      return d;
    }).filter(Boolean);

    if (pathStrings.length === 0) return null;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="transparent"/>
  ${pathStrings.map(d => `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n  ')}
</svg>`;
  }, [paths, width, height, strokeColor, strokeWidth]);

  // Generate thumbnail as data URL
  const generateThumbnail = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || paths.length === 0) return null;

    // Create a smaller canvas for thumbnail
    const thumbCanvas = document.createElement('canvas');
    const thumbWidth = 150;
    const thumbHeight = Math.round(height * (thumbWidth / width));
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;

    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
    return thumbCanvas.toDataURL('image/png', 0.8);
  }, [paths, width, height]);

  // Notify parent of signature changes
  useEffect(() => {
    if (onSignatureChange) {
      const svg = generateSVG();
      const thumbnail = generateThumbnail();
      onSignatureChange(svg, thumbnail);
      setHasSignature(!!svg);
    }
  }, [paths, onSignatureChange, generateSVG, generateThumbnail]);

  // Get pointer position relative to canvas
  const getPointerPosition = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Start drawing
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();

    const pos = getPointerPosition(e);
    if (!pos) return;

    setIsDrawing(true);
    setCurrentPath([pos]);
  };

  // Continue drawing
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const pos = getPointerPosition(e);
    if (!pos) return;

    setCurrentPath((prev) => [...prev, pos]);
  };

  // End drawing
  const handlePointerUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    if (currentPath.length > 1) {
      setPaths((prev) => [...prev, currentPath]);
    }
    setCurrentPath([]);
  };

  // Clear signature
  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
    setHasSignature(false);
  };

  // Undo last stroke
  const handleUndo = () => {
    if (paths.length > 0) {
      setPaths((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative border-2 border-dashed border-zinc-700 rounded-lg overflow-hidden"
        style={{ width: '100%', maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          className={`w-full touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'}`}
          style={{ aspectRatio: `${width} / ${height}` }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
        />

        {/* Signature line indicator */}
        <div
          className="absolute bottom-8 left-8 right-8 border-b border-zinc-400 pointer-events-none"
          style={{ opacity: 0.5 }}
        />

        {/* X mark at start */}
        <div className="absolute bottom-6 left-4 text-zinc-500 text-lg font-serif pointer-events-none">
          X
        </div>

        {/* Helper text */}
        {!hasSignature && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-zinc-500 text-sm">Draw your signature here</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={disabled || paths.length === 0}
          className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-zinc-700 transition-colors"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || paths.length === 0}
          className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-zinc-700 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default SignatureCanvas;
