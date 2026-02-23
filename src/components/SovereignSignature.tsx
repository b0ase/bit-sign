'use client';

import React, { useState, useCallback } from 'react';
import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';

interface SovereignSignatureProps {
    onSave: (signatureData: { svg: string; json: string }) => void;
    onCancel: () => void;
}

export default function SovereignSignature({ onSave, onCancel }: SovereignSignatureProps) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const [saving, setSaving] = useState(false);

    const handleMount = useCallback((editor: Editor) => {
        setEditor(editor);
        editor.updateInstanceState({ isDebugMode: false });
        editor.setCurrentTool('draw');
    }, []);

    const handleSave = async () => {
        if (!editor || saving) return;

        const shapeIds = Array.from(editor.getCurrentPageShapeIds());
        if (shapeIds.length === 0) {
            alert('Please draw your signature before saving.');
            return;
        }

        setSaving(true);
        try {
            const { blob } = await editor.toImage(shapeIds, { format: 'svg', background: false });
            const svgString = await blob.text();
            const documentJson = JSON.stringify(editor.getSnapshot());

            onSave({
                svg: svgString,
                json: documentJson
            });
        } catch (error) {
            console.error('Failed to export signature:', error);
            alert('Failed to save signature. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-12 overflow-hidden">
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

            <div className="flex-1 border border-zinc-800 bg-zinc-950 relative rounded-md overflow-hidden min-h-[400px]">
                <Tldraw
                    onMount={handleMount}
                    inferDarkMode
                    hideUi={true}
                />

                {/* Tool Bar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-black/60 backdrop-blur-md p-1.5 border border-zinc-800 rounded-full z-[1000]">
                    <button
                        onClick={() => editor?.setCurrentTool('select')}
                        className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white text-xs rounded-full hover:bg-zinc-800 transition-colors"
                        title="Select"
                    >
                        Sel
                    </button>
                    <button
                        onClick={() => editor?.setCurrentTool('draw')}
                        className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white text-xs rounded-full hover:bg-zinc-800 transition-colors"
                        title="Draw"
                    >
                        Pen
                    </button>
                    <button
                        onClick={() => editor?.setCurrentTool('eraser')}
                        className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white text-xs rounded-full hover:bg-zinc-800 transition-colors"
                        title="Eraser"
                    >
                        Ers
                    </button>
                    <button
                        onClick={() => editor?.selectAll().deleteShapes(editor.getSelectedShapeIds())}
                        className="w-9 h-9 flex items-center justify-center text-red-500/70 hover:text-red-400 text-xs rounded-full hover:bg-zinc-800 transition-colors"
                        title="Clear all"
                    >
                        Clr
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
