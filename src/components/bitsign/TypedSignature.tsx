'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface TypedSignatureProps {
  onSignatureChange?: (text: string, font: string, svg: string | null) => void;
  initialText?: string;
  initialFont?: string;
  disabled?: boolean;
}

const SIGNATURE_FONTS = [
  { id: 'dancing-script', name: 'Dancing Script', family: "'Dancing Script', cursive" },
  { id: 'great-vibes', name: 'Great Vibes', family: "'Great Vibes', cursive" },
  { id: 'allura', name: 'Allura', family: "'Allura', cursive" },
  { id: 'parisienne', name: 'Parisienne', family: "'Parisienne', cursive" },
  { id: 'alex-brush', name: 'Alex Brush', family: "'Alex Brush', cursive" },
  { id: 'sacramento', name: 'Sacramento', family: "'Sacramento', cursive" },
];

export function TypedSignature({
  onSignatureChange,
  initialText = '',
  initialFont = 'dancing-script',
  disabled = false,
}: TypedSignatureProps) {
  const [text, setText] = useState(initialText);
  const [selectedFont, setSelectedFont] = useState(initialFont);

  // Generate SVG from typed text
  const generateSVG = useCallback((signatureText: string, fontId: string): string | null => {
    if (!signatureText.trim()) return null;

    const font = SIGNATURE_FONTS.find(f => f.id === fontId) || SIGNATURE_FONTS[0];
    const fontSize = 48;
    const width = Math.max(300, signatureText.length * 24);
    const height = 80;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=${font.name.replace(' ', '+')}');
  </style>
  <text
    x="50%"
    y="55"
    text-anchor="middle"
    font-family="${font.family}"
    font-size="${fontSize}"
    fill="#000000"
  >${signatureText}</text>
</svg>`;
  }, []);

  // Notify parent of changes
  useEffect(() => {
    if (onSignatureChange) {
      const svg = generateSVG(text, selectedFont);
      onSignatureChange(text, selectedFont, svg);
    }
  }, [text, selectedFont, onSignatureChange, generateSVG]);

  const currentFont = SIGNATURE_FONTS.find(f => f.id === selectedFont) || SIGNATURE_FONTS[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Font selection */}
      <div className="flex flex-wrap gap-2">
        {SIGNATURE_FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => setSelectedFont(font.id)}
            disabled={disabled}
            className={`px-3 py-2 text-xs font-mono uppercase tracking-wider border transition-colors ${
              selectedFont === font.id
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {font.name}
          </button>
        ))}
      </div>

      {/* Text input */}
      <div className="relative">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your name..."
          disabled={disabled}
          maxLength={50}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
          {text.length}/50
        </span>
      </div>

      {/* Preview */}
      <div className="relative border border-zinc-700 rounded-lg bg-white p-6 min-h-[100px] flex items-center justify-center">
        {text.trim() ? (
          <>
            {/* Load Google Font */}
            <link
              href={`https://fonts.googleapis.com/css2?family=${currentFont.name.replace(' ', '+')}&display=swap`}
              rel="stylesheet"
            />
            <span
              className="text-4xl text-black text-center"
              style={{ fontFamily: currentFont.family }}
            >
              {text}
            </span>
          </>
        ) : (
          <span className="text-zinc-400 text-sm">Your signature will appear here</span>
        )}

        {/* Signature line */}
        <div className="absolute bottom-6 left-8 right-8 border-b border-zinc-300" />
      </div>

      {/* Info */}
      <p className="text-xs text-zinc-500">
        Type your full legal name as it should appear on documents.
      </p>
    </div>
  );
}

export default TypedSignature;
