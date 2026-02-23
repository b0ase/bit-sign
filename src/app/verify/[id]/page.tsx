'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FiCheck, FiClock, FiShield, FiExternalLink,
  FiAlertCircle, FiFileText, FiHash, FiUser, FiDownload
} from 'react-icons/fi';

interface VerificationData {
  envelope: {
    id: string;
    title: string;
    document_type: string;
    status: string;
    document_hash: string;
    created_by: string;
    created_at: string;
  };
  signers: {
    name: string;
    role: string;
    status: string;
    signed_at: string | null;
  }[];
  blockchain: {
    verified: boolean;
    txid: string;
    explorer_url: string;
    data_hash?: string;
    inscribed_at?: string;
    error?: string;
  } | null;
}

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerificationData | null>(null);

  useEffect(() => {
    if (id) fetchVerification();
  }, [id]);

  const fetchVerification = async () => {
    try {
      const res = await fetch(`/api/envelopes/${id}/verify`);
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err) {
      setError('Failed to load verification data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white animate-spin opacity-20" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <FiAlertCircle className="text-red-500 text-4xl mb-6" />
        <h1 className="text-3xl font-mono font-black mb-4 tracking-tighter uppercase italic">Not Found</h1>
        <p className="text-zinc-500 font-mono text-sm">{error || 'Envelope not found'}</p>
      </div>
    );
  }

  const { envelope, signers, blockchain } = data;
  const allSigned = signers.every(s => s.status === 'signed');
  const signedCount = signers.filter(s => s.status === 'signed').length;

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-6 pt-24 max-w-3xl mx-auto space-y-8 pb-40">
        {/* Verification Header */}
        <header className="text-center space-y-4 border-b border-zinc-900 pb-8">
          {allSigned && blockchain?.verified ? (
            <FiShield className="mx-auto text-green-400" size={48} />
          ) : allSigned ? (
            <FiCheck className="mx-auto text-green-400" size={48} />
          ) : (
            <FiClock className="mx-auto text-amber-400" size={48} />
          )}

          <h1 className="text-4xl font-mono font-black tracking-tighter uppercase italic">{envelope.title}</h1>

          <div className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-widest">
            {allSigned && blockchain?.verified ? (
              <span className="text-green-400 bg-green-950 px-3 py-1">Verified on Blockchain</span>
            ) : allSigned ? (
              <span className="text-green-400 bg-green-950 px-3 py-1">Fully Signed</span>
            ) : (
              <span className="text-amber-400 bg-amber-950 px-3 py-1">{signedCount}/{signers.length} Signed</span>
            )}
          </div>
        </header>

        {/* Document Details */}
        <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
          <div className="bg-black p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiFileText size={12} />
              <span className="text-[9px] font-mono uppercase tracking-widest">Document Type</span>
            </div>
            <span className="font-mono text-sm font-bold uppercase tracking-wider">{envelope.document_type.replace(/_/g, ' ')}</span>
          </div>
          <div className="bg-black p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiUser size={12} />
              <span className="text-[9px] font-mono uppercase tracking-widest">Created By</span>
            </div>
            <span className="font-mono text-sm font-bold">${envelope.created_by}</span>
          </div>
          <div className="bg-black p-5 col-span-2">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiHash size={12} />
              <span className="text-[9px] font-mono uppercase tracking-widest">Document Hash (SHA-256)</span>
            </div>
            <span className="font-mono text-xs text-zinc-300 break-all">{envelope.document_hash}</span>
          </div>
        </div>

        {/* Signers */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-2">
            <span className="w-1 h-1 bg-white" /> Signers
          </h3>

          {signers.map((signer, i) => (
            <div
              key={i}
              className={`p-5 border flex items-center justify-between ${
                signer.status === 'signed'
                  ? 'border-green-900/50 bg-green-950/10'
                  : 'border-zinc-900 bg-zinc-950'
              }`}
            >
              <div>
                <span className="block font-mono text-sm font-bold uppercase tracking-wider">{signer.name}</span>
                <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{signer.role}</span>
              </div>
              <div className="text-right">
                {signer.status === 'signed' ? (
                  <>
                    <span className="flex items-center gap-2 text-green-400 font-mono text-[10px] uppercase tracking-widest">
                      <FiCheck size={12} /> Signed
                    </span>
                    <span className="block font-mono text-[9px] text-zinc-600 mt-1">
                      {new Date(signer.signed_at!).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-zinc-600 font-mono text-[10px] uppercase tracking-widest">
                    <FiClock size={12} /> Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Blockchain Proof */}
        {blockchain && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-2">
              <span className="w-1 h-1 bg-green-500" /> Blockchain Proof
            </h3>

            <div className={`p-6 border space-y-4 ${
              blockchain.verified
                ? 'border-green-900/50 bg-green-950/10'
                : 'border-amber-900/50 bg-amber-950/10'
            }`}>
              <div className="flex items-center gap-3">
                {blockchain.verified ? (
                  <FiShield className="text-green-400" size={20} />
                ) : (
                  <FiAlertCircle className="text-amber-400" size={20} />
                )}
                <span className={`font-mono text-xs font-bold uppercase tracking-widest ${
                  blockchain.verified ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {blockchain.verified ? 'On-Chain Verification Passed' : 'Pending Verification'}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Transaction ID</span>
                  <span className="block font-mono text-xs text-zinc-300 break-all">{blockchain.txid}</span>
                </div>

                {blockchain.data_hash && (
                  <div>
                    <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Data Hash</span>
                    <span className="block font-mono text-xs text-zinc-300 break-all">{blockchain.data_hash}</span>
                  </div>
                )}

                {blockchain.inscribed_at && (
                  <div>
                    <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Inscribed At</span>
                    <span className="block font-mono text-xs text-zinc-300">
                      {new Date(blockchain.inscribed_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <a
                href={blockchain.explorer_url}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-white text-white font-mono text-[10px] uppercase tracking-widest transition-all"
              >
                View on WhatsOnChain <FiExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Download PDF */}
        {allSigned && (
          <div className="text-center">
            <a
              href={`/api/envelopes/${id}/pdf`}
              target="_blank"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all"
            >
              <FiDownload size={14} /> Download Signed PDF
            </a>
          </div>
        )}

        {/* Proof Footer */}
        <div className="border-t border-zinc-900 pt-8 text-center space-y-2">
          <p className="font-mono text-[9px] text-zinc-600 uppercase tracking-[0.3em]">
            Verified by BIT-SIGN | Sovereignty as a Service
          </p>
          <p className="font-mono text-[9px] text-zinc-700 uppercase tracking-widest">
            bit-sign.online/verify/{id}
          </p>
        </div>
      </div>
    </div>
  );
}
