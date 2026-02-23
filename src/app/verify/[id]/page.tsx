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
    inscription_txid: string | null;
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
        <div className="w-12 h-12 border-t-2 border-white animate-spin rounded-full opacity-20" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <FiAlertCircle className="text-red-500 text-4xl mb-6" />
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Not Found</h1>
        <p className="text-zinc-400 text-sm">{error || 'Envelope not found'}</p>
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

          <h1 className="text-3xl font-bold tracking-tight">{envelope.title}</h1>

          <div className="inline-flex items-center gap-2">
            {allSigned && blockchain?.verified ? (
              <span className="text-green-400 bg-green-950 px-3 py-1.5 text-xs rounded">Verified on Blockchain</span>
            ) : allSigned ? (
              <span className="text-green-400 bg-green-950 px-3 py-1.5 text-xs rounded">Fully Signed</span>
            ) : (
              <span className="text-amber-400 bg-amber-950 px-3 py-1.5 text-xs rounded">{signedCount}/{signers.length} Signed</span>
            )}
          </div>
        </header>

        {/* Document Details */}
        <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 rounded-md overflow-hidden">
          <div className="bg-black p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiFileText size={12} />
              <span className="text-xs">Document Type</span>
            </div>
            <span className="text-sm font-medium">{envelope.document_type.replace(/_/g, ' ')}</span>
          </div>
          <div className="bg-black p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiUser size={12} />
              <span className="text-xs">Created By</span>
            </div>
            <span className="text-sm font-medium">{envelope.created_by}</span>
          </div>
          <div className="bg-black p-5 col-span-2">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiHash size={12} />
              <span className="text-xs">Document Hash (SHA-256)</span>
            </div>
            <span className="font-mono text-xs text-zinc-300 break-all">{envelope.document_hash}</span>
          </div>
        </div>

        {/* Signers */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full" /> Signers
          </h3>

          {signers.map((signer, i) => (
            <div
              key={i}
              className={`p-5 border rounded-md flex items-center justify-between ${
                signer.status === 'signed'
                  ? 'border-green-900/50 bg-green-950/10'
                  : 'border-zinc-900 bg-zinc-950'
              }`}
            >
              <div>
                <span className="block text-sm font-medium">{signer.name}</span>
                <span className="block text-xs text-zinc-500">{signer.role}</span>
              </div>
              <div className="text-right">
                {signer.status === 'signed' ? (
                  <div className="space-y-1">
                    <span className="flex items-center justify-end gap-2 text-green-400 text-xs">
                      <FiCheck size={12} /> Signed
                    </span>
                    <span className="block text-xs text-zinc-600">
                      {new Date(signer.signed_at!).toLocaleString()}
                    </span>
                    {signer.inscription_txid && (
                      <a
                        href={`https://whatsonchain.com/tx/${signer.inscription_txid}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
                      >
                        <FiExternalLink size={10} /> On-chain proof
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="flex items-center gap-2 text-zinc-500 text-xs">
                    <FiClock size={12} /> Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Blockchain Proof - Inscription Pending Warning */}
        {allSigned && !blockchain && (
          <div className="p-6 border border-amber-900/50 bg-amber-950/10 rounded-md space-y-2">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-amber-400" size={20} />
              <span className="text-sm font-medium text-amber-400">Blockchain inscription pending</span>
            </div>
            <p className="text-xs text-zinc-500">
              All parties have signed, but the summary inscription has not been recorded on-chain yet.
              Individual signer proofs may still be available above.
            </p>
          </div>
        )}

        {/* Blockchain Proof */}
        {blockchain && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" /> Blockchain Proof
            </h3>

            <div className={`p-6 border rounded-md space-y-4 ${
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
                <span className={`text-sm font-medium ${
                  blockchain.verified ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {blockchain.verified ? 'On-chain verification passed' : 'Pending verification'}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="block text-xs text-zinc-500">Transaction ID</span>
                  <span className="block font-mono text-xs text-zinc-300 break-all">{blockchain.txid}</span>
                </div>

                {blockchain.data_hash && (
                  <div>
                    <span className="block text-xs text-zinc-500">Data Hash</span>
                    <span className="block font-mono text-xs text-zinc-300 break-all">{blockchain.data_hash}</span>
                  </div>
                )}

                {blockchain.inscribed_at && (
                  <div>
                    <span className="block text-xs text-zinc-500">Inscribed At</span>
                    <span className="block text-sm text-zinc-300">
                      {new Date(blockchain.inscribed_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <a
                href={blockchain.explorer_url}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-white text-white text-sm rounded-md transition-all"
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-all"
            >
              <FiDownload size={14} /> Download Signed PDF
            </a>
          </div>
        )}

        {/* Proof Footer */}
        <div className="border-t border-zinc-900 pt-8 text-center space-y-1">
          <p className="text-sm text-zinc-500">
            Verified by Bit-Sign
          </p>
          <p className="font-mono text-xs text-zinc-600">
            bit-sign.online/verify/{id}
          </p>
        </div>
      </div>
    </div>
  );
}
