'use client';

import React from 'react';
import { FiCheck, FiExternalLink, FiShield } from 'react-icons/fi';

interface SignatureDisplayProps {
  signature: {
    id: string;
    signature_type: 'drawn' | 'typed' | 'upload';
    svg_data?: string;
    image_data?: string;
    typed_text?: string;
    typed_font?: string;
    wallet_address?: string;
    wallet_type?: string;
    inscription_txid?: string;
    inscription_url?: string;
    created_at?: string;
    is_default?: boolean;
  };
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const FONT_FAMILIES: Record<string, string> = {
  'dancing-script': "'Dancing Script', cursive",
  'great-vibes': "'Great Vibes', cursive",
  'allura': "'Allura', cursive",
  'parisienne': "'Parisienne', cursive",
  'alex-brush': "'Alex Brush', cursive",
  'sacramento': "'Sacramento', cursive",
};

export function SignatureDisplay({
  signature,
  showDetails = false,
  size = 'md',
  onClick,
  className = '',
}: SignatureDisplayProps) {
  const sizeClasses = {
    sm: 'h-16',
    md: 'h-24',
    lg: 'h-32',
  };

  const isVerified = !!signature.wallet_address;
  const isInscribed = !!signature.inscription_txid;

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-lg border border-zinc-200 overflow-hidden ${onClick ? 'cursor-pointer hover:border-zinc-400 transition-colors' : ''
        } ${className}`}
    >
      {/* Signature area */}
      <div className={`${sizeClasses[size]} flex items-center justify-center p-4`}>
        {signature.signature_type === 'drawn' && signature.svg_data ? (
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{
              __html: signature.svg_data.replace(
                '<svg',
                '<svg style="width:100%;height:100%;object-fit:contain"'
              ),
            }}
          />
        ) : signature.signature_type === 'upload' && signature.image_data ? (
          <img
            src={signature.image_data}
            alt="Signature"
            className="w-full h-full object-contain"
          />
        ) : signature.signature_type === 'typed' && signature.typed_text ? (
          <>
            <link
              href={`https://fonts.googleapis.com/css2?family=${(signature.typed_font || 'dancing-script').replace('-', '+').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('+')}&display=swap`}
              rel="stylesheet"
            />
            <span
              className="text-black text-center"
              style={{
                fontFamily: FONT_FAMILIES[signature.typed_font || 'dancing-script'],
                fontSize: size === 'sm' ? '1.5rem' : size === 'md' ? '2rem' : '2.5rem',
              }}
            >
              {signature.typed_text}
            </span>
          </>
        ) : (
          <span className="text-zinc-400 text-sm">No signature</span>
        )}
      </div>

      {/* Signature line */}
      <div className="absolute bottom-4 left-4 right-4 border-b border-zinc-300" />

      {/* Verification badges */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isVerified && (
          <div
            className="p-1 bg-green-100 rounded"
            title={`Verified with ${signature.wallet_type}`}
          >
            <FiCheck className="w-3 h-3 text-green-600" />
          </div>
        )}
        {isInscribed && (
          <a
            href={signature.inscription_url || `https://whatsonchain.com/tx/${signature.inscription_txid}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
            title="View on blockchain"
          >
            <FiShield className="w-3 h-3 text-blue-600" />
          </a>
        )}
        {signature.is_default && (
          <div className="px-1.5 py-0.5 bg-amber-100 rounded text-[10px] text-amber-700 font-medium">
            Default
          </div>
        )}
      </div>

      {/* Details section */}
      {showDetails && (
        <div className="border-t border-zinc-200 p-3 bg-zinc-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              {signature.signature_type === 'drawn' ? 'Drawn signature' : signature.signature_type === 'upload' ? 'Uploaded signature' : 'Typed signature'}
            </span>
            {signature.wallet_address && (
              <span className="text-zinc-600 font-mono">
                {signature.wallet_address.slice(0, 6)}...{signature.wallet_address.slice(-4)}
              </span>
            )}
          </div>

          {signature.inscription_txid && (
            <a
              href={signature.inscription_url || `https://whatsonchain.com/tx/${signature.inscription_txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <FiExternalLink size={10} />
              View on BSV blockchain
            </a>
          )}

          {signature.created_at && (
            <div className="mt-1 text-[10px] text-zinc-400">
              Created {new Date(signature.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SignatureDisplay;
