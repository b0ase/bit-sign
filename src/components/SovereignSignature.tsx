'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SovereignSignatureProps {
    onSave: (signatureData: { svg: string; json: string }) => void;
    onCancel: () => void;
}

interface Point {
    x: number;
    y: number;
    pressure: number;
}

export default function SovereignSignature({ onSave, onCancel }: SovereignSignatureProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const currentStrokeRef = useRef<Point[]>([]);
    const strokesRef = useRef<Point[][]>([]);
    const dprRef = useRef(1);

    const [strokeCount, setStrokeCount] = useState(0);
    const [saving, setSaving] = useState(false);

    // Full redraw of all strokes
    const redrawCanvas = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = container.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Signature guide line
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, h - 60);
        ctx.lineTo(w - 40, h - 60);
        ctx.stroke();

        // Draw all completed strokes
        for (const stroke of strokesRef.current) {
            drawStroke(ctx, stroke);
        }
    };

    const drawStroke = (ctx: CanvasRenderingContext2D, points: Point[]) => {
        if (points.length < 2) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const width = 1 + curr.pressure * 4;

            ctx.strokeStyle = 'white';
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }
    };

    // Size canvas to container — only on mount and actual resizes
    const sizeCanvas = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        dprRef.current = dpr;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            redrawCanvas();
        }
    };

    // Set up canvas sizing with ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Initial size (delayed to ensure layout)
        const raf = requestAnimationFrame(() => sizeCanvas());

        const observer = new ResizeObserver(() => sizeCanvas());
        observer.observe(container);

        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, []);

    const getPoint = (e: React.PointerEvent): Point => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure || 0.5,
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.setPointerCapture(e.pointerId);
        isDrawingRef.current = true;
        currentStrokeRef.current = [getPoint(e)];
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();

        const point = getPoint(e);
        currentStrokeRef.current.push(point);

        // Draw incrementally — no state updates, no re-renders
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const points = currentStrokeRef.current;
        if (points.length >= 2) {
            const prev = points[points.length - 2];
            const curr = points[points.length - 1];
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1 + curr.pressure * 4;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        if (currentStrokeRef.current.length > 1) {
            strokesRef.current = [...strokesRef.current, [...currentStrokeRef.current]];
            setStrokeCount(strokesRef.current.length);
        }
        currentStrokeRef.current = [];
    };

    const handleClear = () => {
        strokesRef.current = [];
        currentStrokeRef.current = [];
        setStrokeCount(0);
        redrawCanvas();
    };

    const handleUndo = () => {
        strokesRef.current = strokesRef.current.slice(0, -1);
        currentStrokeRef.current = [];
        setStrokeCount(strokesRef.current.length);
        redrawCanvas();
    };

    const handleSave = async () => {
        if (strokesRef.current.length === 0) {
            alert('Please draw your signature before saving.');
            return;
        }

        setSaving(true);
        try {
            const container = containerRef.current!;
            const rect = container.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            const strokes = strokesRef.current;

            // Find bounding box
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const stroke of strokes) {
                for (const p of stroke) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
            }

            const pad = 20;
            minX = Math.max(0, minX - pad);
            minY = Math.max(0, minY - pad);
            maxX = Math.min(w, maxX + pad);
            maxY = Math.min(h, maxY + pad);
            const svgW = maxX - minX;
            const svgH = maxY - minY;

            let paths = '';
            for (const stroke of strokes) {
                if (stroke.length < 2) continue;
                let d = `M ${(stroke[0].x - minX).toFixed(1)} ${(stroke[0].y - minY).toFixed(1)}`;
                for (let i = 1; i < stroke.length; i++) {
                    d += ` L ${(stroke[i].x - minX).toFixed(1)} ${(stroke[i].y - minY).toFixed(1)}`;
                }
                const avgPressure = stroke.reduce((s, p) => s + p.pressure, 0) / stroke.length;
                const sw = (1 + avgPressure * 4).toFixed(1);
                paths += `<path d="${d}" stroke="black" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
            }

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" width="${svgW.toFixed(0)}" height="${svgH.toFixed(0)}">${paths}</svg>`;

            onSave({
                svg,
                json: JSON.stringify({ strokes, width: w, height: h }),
            });
        } catch (error) {
            console.error('Failed to export signature:', error);
            alert('Failed to save signature. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col px-6 pt-24 pb-6 md:px-12 md:pt-28 md:pb-12 overflow-hidden">
            <header className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-white">Draw Your Signature</h2>
                    <p className="text-sm text-zinc-500 mt-1">Use your mouse or touchscreen to sign below</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2 border border-zinc-700 text-zinc-400 text-sm rounded-md hover:text-white hover:border-zinc-500 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Signature'}
                    </button>
                </div>
            </header>

            <div
                ref={containerRef}
                className="flex-1 border border-zinc-800 bg-zinc-950 relative rounded-md overflow-hidden min-h-[300px]"
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 cursor-crosshair"
                    style={{ touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />

                {strokeCount === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-zinc-700 text-lg">Sign here</p>
                    </div>
                )}

                {/* Toolbar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    <button
                        onClick={handleUndo}
                        disabled={strokeCount === 0}
                        className="px-4 py-2 bg-black/60 backdrop-blur-md border border-zinc-800 text-zinc-400 text-sm rounded-full hover:text-white hover:border-zinc-600 transition-all disabled:opacity-30"
                    >
                        Undo
                    </button>
                    <button
                        onClick={handleClear}
                        disabled={strokeCount === 0}
                        className="px-4 py-2 bg-black/60 backdrop-blur-md border border-zinc-800 text-red-500/70 text-sm rounded-full hover:text-red-400 hover:border-red-900 transition-all disabled:opacity-30"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <footer className="mt-4 flex justify-center">
                <p className="text-xs text-zinc-600">
                    Your signature will be encrypted and recorded on the blockchain.
                </p>
            </footer>
        </div>
    );
}
