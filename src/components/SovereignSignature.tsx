'use client';

import React, { useState, useCallback } from 'react';
import { Tldraw, Editor, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';

interface SovereignSignatureProps {
    onSave: (signatureData: { svg: string; json: string }) => void;
    onCancel: () => void;
}

export default function SovereignSignature({ onSave, onCancel }: SovereignSignatureProps) {
    const [editor, setEditor] = useState<Editor | null>(null);

    const handleMount = useCallback((editor: Editor) => {
        setEditor(editor);
        // Set explicit theme/industrial style if possible
        editor.updateInstanceState({ isDebugMode: false });
    }, []);

    const handleSave = async () => {
        if (!editor) return;

        // 1. Get SVG for preview/on-chain attestation
        const shapes = Array.from(editor.getCurrentPageShapes());
        if (shapes.length === 0) {
            alert('Please draw your signature before saving.');
            return;
        }

        const svgElement = await (editor as any).getSvg(Array.from(editor.getCurrentPageShapeIds()));
        const svgString = new XMLSerializer().serializeToString(svgElement!);

        // 2. Get JSON for exact reconstruction if needed
        const documentJson = JSON.stringify(editor.getSnapshot());

        onSave({
            svg: svgString,
            json: documentJson
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-12 overflow-hidden">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-mono font-bold uppercase tracking-tighter text-white">Capture Intent</h2>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mt-1">Sovereign Hand-Written Signature</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 border border-white/10 text-neutral-500 font-mono font-bold uppercase text-xs hover:text-white hover:border-white/40 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-white text-black font-mono font-bold uppercase text-xs hover:bg-neutral-200 transition-colors"
                    >
                        Lock Signature
                    </button>
                </div>
            </header>

            <div className="flex-1 border border-white/10 bg-neutral-900/50 relative rounded-sm overflow-hidden min-h-[400px]">
                <Tldraw
                    onMount={handleMount}
                    inferDarkMode
                    hideUi={true} // Keep it minimal for industrial feel
                />

                {/* Minimal Tool Overlay */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-md p-2 border border-white/10 rounded-full z-[1000]">
                    <button
                        onClick={() => editor?.updateInstanceState({ intent: 'select' } as any)}
                        className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white font-mono text-[10px] uppercase"
                    >
                        Sel
                    </button>
                    <button
                        onClick={() => editor?.setCurrentTool('draw')}
                        className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white font-mono text-[10px] uppercase border-l border-white/10"
                    >
                        Pen
                    </button>
                    <button
                        onClick={() => editor?.setCurrentTool('eraser')}
                        className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white font-mono text-[10px] uppercase border-l border-white/10"
                    >
                        Eras
                    </button>
                    <button
                        onClick={() => editor?.selectAll().deleteShapes(editor.getSelectedShapeIds())}
                        className="w-10 h-10 flex items-center justify-center text-red-500/50 hover:text-red-500 font-mono text-[10px] uppercase border-l border-white/10"
                    >
                        Clr
                    </button>
                </div>
            </div>

            <footer className="mt-6 flex justify-center">
                <p className="font-mono text-[9px] text-neutral-600 uppercase tracking-widest italic">
                    "The handwritten signature is the final biological proof of intent in a digital world."
                </p>
            </footer>
        </div>
    );
}
