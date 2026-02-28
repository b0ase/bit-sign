'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FiCheck, FiClock, FiShield, FiExternalLink,
  FiAlertCircle, FiFileText, FiHash, FiUser, FiDownload,
  FiChevronDown, FiChevronUp,
} from 'react-icons/fi';

// ─── Envelope types (existing) ───────────────────────────────────────
interface EnvelopeVerificationData {
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

// ─── Seal types (new) ───────────────────────────────────────────────
interface SealVerificationData {
  signature: {
    id: string;
    signatureType: string;
    signerHandle: string;
    walletAddress: string | null;
    walletSigned: boolean;
    originalFileName: string | null;
    sealedAt: string;
  };
  provenance: {
    preInscriptionHash: string | null;
    sealTxid: string | null;
    finalHash: string | null;
    confirmationTxid: string | null;
  };
  verification: {
    status: 'full' | 'partial' | 'seal_only' | 'unverified';
    seal: { found: boolean; matchesPreInscription?: boolean; error?: string } | null;
    confirmation: { found: boolean; matchesFinalHash?: boolean; matchesSealTxid?: boolean; error?: string } | null;
  };
  explorerUrls: {
    seal: string | null;
    confirmation: string | null;
  };
}

type Mode = 'loading' | 'envelope' | 'seal' | 'error';

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [mode, setMode] = useState<Mode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [envelopeData, setEnvelopeData] = useState<EnvelopeVerificationData | null>(null);
  const [sealData, setSealData] = useState<SealVerificationData | null>(null);

  useEffect(() => {
    if (id) fetchVerification();
  }, [id]);

  const fetchVerification = async () => {
    // Try signature verify first (sealed documents)
    try {
      const sealRes = await fetch(`/api/bitsign/signatures/${id}/verify`);
      if (sealRes.ok) {
        const result = await sealRes.json();
        if (result.signature && result.provenance) {
          setSealData(result);
          setMode('seal');
          return;
        }
      }
    } catch {}

    // Fall back to envelope verify
    try {
      const envRes = await fetch(`/api/envelopes/${id}/verify`);
      const result = await envRes.json();
      if (result.error) {
        setError(result.error);
        setMode('error');
      } else {
        setEnvelopeData(result);
        setMode('envelope');
      }
    } catch {
      setError('Failed to load verification data');
      setMode('error');
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white animate-spin rounded-full opacity-20" />
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <FiAlertCircle className="text-red-500 text-4xl mb-6" />
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Not Found</h1>
        <p className="text-zinc-400 text-sm">{error || 'Document not found'}</p>
      </div>
    );
  }

  if (mode === 'seal' && sealData) return <SealVerifyView data={sealData} id={id} />;
  if (mode === 'envelope' && envelopeData) return <EnvelopeVerifyView data={envelopeData} id={id} />;

  return null;
}

// ─── Envelope Verify (existing UI, unchanged) ───────────────────────
function EnvelopeVerifyView({ data, id }: { data: EnvelopeVerificationData; id: string }) {
  const { envelope, signers, blockchain } = data;
  const allSigned = signers.every(s => s.status === 'signed');
  const signedCount = signers.filter(s => s.status === 'signed').length;

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-4 sm:p-6 pt-20 sm:pt-24 max-w-3xl mx-auto space-y-6 sm:space-y-8 pb-40">
        <header className="text-center space-y-4 border-b border-zinc-900 pb-6 sm:pb-8">
          {allSigned && blockchain?.verified ? (
            <FiShield className="mx-auto text-green-400" size={48} />
          ) : allSigned ? (
            <FiCheck className="mx-auto text-green-400" size={48} />
          ) : (
            <FiClock className="mx-auto text-amber-400" size={48} />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{envelope.title}</h1>
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

        <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 rounded-md overflow-hidden">
          <div className="bg-black p-3 sm:p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiFileText size={12} />
              <span className="text-xs">Document Type</span>
            </div>
            <span className="text-sm font-medium">{envelope.document_type.replace(/_/g, ' ')}</span>
          </div>
          <div className="bg-black p-3 sm:p-5">
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

        <div className="border-t border-zinc-900 pt-8 text-center space-y-1">
          <p className="text-sm text-zinc-500">Verified by Bit-Sign</p>
          <p className="font-mono text-xs text-zinc-600">bit-sign.online/verify/{id}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Seal Verify (new UI) ───────────────────────────────────────────
function SealVerifyView({ data, id }: { data: SealVerificationData; id: string }) {
  const [howToOpen, setHowToOpen] = useState(false);
  const { signature, provenance, verification, explorerUrls } = data;

  const isFullyVerified = verification.status === 'full';
  const isPartial = verification.status === 'partial' || verification.status === 'seal_only';

  const statusColor = isFullyVerified ? 'green' : isPartial ? 'amber' : 'red';
  const statusLabel = isFullyVerified
    ? 'Full Chain Verified'
    : verification.status === 'seal_only'
    ? 'Seal Verified (no confirmation)'
    : isPartial
    ? 'Partially Verified'
    : 'Unverified';

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-4 sm:p-6 pt-20 sm:pt-24 max-w-3xl mx-auto space-y-6 sm:space-y-8 pb-40">
        {/* Header */}
        <header className="text-center space-y-4 border-b border-zinc-900 pb-6 sm:pb-8">
          <FiShield className={`mx-auto text-${statusColor}-400`} size={48} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {signature.originalFileName || 'Sealed Document'}
          </h1>
          <div className="inline-flex items-center gap-2">
            <span className={`text-${statusColor}-400 bg-${statusColor}-950 px-3 py-1.5 text-xs rounded`}>
              {statusLabel}
            </span>
          </div>
        </header>

        {/* Signer Info */}
        <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 rounded-md overflow-hidden">
          <div className="bg-black p-3 sm:p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiUser size={12} />
              <span className="text-xs">Signer</span>
            </div>
            <span className="text-sm font-medium">${signature.signerHandle}</span>
          </div>
          <div className="bg-black p-3 sm:p-5">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <FiClock size={12} />
              <span className="text-xs">Sealed</span>
            </div>
            <span className="text-sm font-medium">
              {new Date(signature.sealedAt).toLocaleDateString()}
            </span>
          </div>
          {signature.walletAddress && (
            <div className="bg-black p-5 col-span-2">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <FiHash size={12} />
                <span className="text-xs">Wallet Address</span>
              </div>
              <span className="font-mono text-xs text-zinc-300 break-all">{signature.walletAddress}</span>
            </div>
          )}
        </div>

        {/* Hash Chain Visualization */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full" /> Provenance Chain
          </h3>

          <div className="space-y-0">
            <HashChainNode
              step={1}
              label="Pre-Inscription Hash"
              sublabel="Document hash before TXID was burned in"
              value={provenance.preInscriptionHash}
              verified={verification.seal?.found && verification.seal?.matchesPreInscription}
              explorerUrl={null}
            />
            <ChainConnector />
            <HashChainNode
              step={2}
              label="Seal Transaction"
              sublabel="On-chain inscription of pre-inscription hash"
              value={provenance.sealTxid}
              verified={verification.seal?.found}
              explorerUrl={explorerUrls.seal}
            />
            <ChainConnector />
            <HashChainNode
              step={3}
              label="Final Document Hash"
              sublabel="Hash of document with TXID visible"
              value={provenance.finalHash}
              verified={verification.confirmation?.matchesFinalHash}
              explorerUrl={null}
            />
            <ChainConnector />
            <HashChainNode
              step={4}
              label="Confirmation Transaction"
              sublabel="On-chain inscription linking final hash to seal"
              value={provenance.confirmationTxid}
              verified={verification.confirmation?.found && verification.confirmation?.matchesFinalHash && verification.confirmation?.matchesSealTxid}
              explorerUrl={explorerUrls.confirmation}
            />
          </div>
        </div>

        {/* Verification Summary */}
        <div className={`p-6 border rounded-md space-y-3 ${
          isFullyVerified
            ? 'border-green-900/50 bg-green-950/10'
            : isPartial
            ? 'border-amber-900/50 bg-amber-950/10'
            : 'border-red-900/50 bg-red-950/10'
        }`}>
          <div className="flex items-center gap-3">
            {isFullyVerified ? (
              <FiShield className="text-green-400" size={20} />
            ) : isPartial ? (
              <FiAlertCircle className="text-amber-400" size={20} />
            ) : (
              <FiAlertCircle className="text-red-400" size={20} />
            )}
            <span className={`text-sm font-medium ${
              isFullyVerified ? 'text-green-400' : isPartial ? 'text-amber-400' : 'text-red-400'
            }`}>
              {isFullyVerified
                ? 'Full provenance chain verified on blockchain'
                : isPartial
                ? 'Seal inscription verified; confirmation pending or mismatched'
                : 'Could not verify on-chain data'}
            </span>
          </div>
          {isFullyVerified && (
            <p className="text-xs text-zinc-500">
              Both the pre-inscription hash and the final document hash are recorded on the Bitcoin SV blockchain.
              The confirmation transaction links the final hash back to the seal, closing the provenance loop.
            </p>
          )}
        </div>

        {/* How to verify independently */}
        <div className="border border-zinc-900 rounded-md overflow-hidden">
          <button
            onClick={() => setHowToOpen(!howToOpen)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-950 transition-colors"
          >
            <span className="text-sm font-medium text-zinc-400">How to verify independently</span>
            {howToOpen ? <FiChevronUp size={16} className="text-zinc-500" /> : <FiChevronDown size={16} className="text-zinc-500" />}
          </button>
          {howToOpen && (
            <div className="px-5 pb-5 space-y-3 text-xs text-zinc-500 border-t border-zinc-900 pt-4">
              <p>1. Download the sealed document from the signer who shared it.</p>
              <p>2. Compute the SHA-256 hash of the file. On macOS/Linux:</p>
              <code className="block bg-zinc-950 px-3 py-2 rounded text-zinc-400 font-mono">
                shasum -a 256 sealed-document.png
              </code>
              <p>3. The resulting hash should match the <strong className="text-zinc-300">Final Document Hash</strong> above.</p>
              <p>4. Click the WhatsOnChain links above to verify both transactions exist on-chain and contain the expected hashes.</p>
              <p>5. The <strong className="text-zinc-300">Confirmation Transaction</strong> should contain both the final hash and a reference to the seal TXID, proving the chain is unbroken.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-900 pt-8 text-center space-y-1">
          <p className="text-sm text-zinc-500">Verified by Bit-Sign</p>
          <p className="font-mono text-xs text-zinc-600">bit-sign.online/verify/{id}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Hash Chain Node ────────────────────────────────────────────────
function HashChainNode({
  step,
  label,
  sublabel,
  value,
  verified,
  explorerUrl,
}: {
  step: number;
  label: string;
  sublabel: string;
  value: string | null;
  verified?: boolean;
  explorerUrl: string | null;
}) {
  const borderColor = !value
    ? 'border-zinc-800'
    : verified
    ? 'border-green-900/60'
    : 'border-amber-900/60';

  const bgColor = !value
    ? 'bg-zinc-950'
    : verified
    ? 'bg-green-950/10'
    : 'bg-amber-950/10';

  return (
    <div className={`p-4 border rounded-md ${borderColor} ${bgColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400 shrink-0">
              {step}
            </span>
            <span className="text-sm font-medium">{label}</span>
            {value && (
              verified ? (
                <FiCheck size={14} className="text-green-400 shrink-0" />
              ) : (
                <FiClock size={14} className="text-amber-400 shrink-0" />
              )
            )}
          </div>
          <p className="text-xs text-zinc-600 mb-2 pl-7">{sublabel}</p>
          {value ? (
            <p className="font-mono text-xs text-zinc-400 break-all pl-7">{value}</p>
          ) : (
            <p className="text-xs text-zinc-600 italic pl-7">Not available</p>
          )}
        </div>
        {explorerUrl && value && (
          <a
            href={explorerUrl}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors shrink-0 mt-1"
          >
            <FiExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function ChainConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="w-px h-4 bg-zinc-800" />
    </div>
  );
}
