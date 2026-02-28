'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiFileText, FiPlus, FiClock, FiCheck, FiAlertCircle,
  FiExternalLink, FiEdit3, FiCopy, FiChevronDown, FiChevronUp,
  FiShield, FiMail, FiUpload, FiArrowLeft
} from 'react-icons/fi';
import { SendEmailModal } from '@/components/SendEmailModal';

interface Signer {
  name: string;
  role: string;
  order: number;
  status: string;
  signed_at: string | null;
  signing_token?: string;
  email?: string | null;
  email_sent_at?: string | null;
  email_sent_to?: string | null;
}

interface Envelope {
  id: string;
  title: string;
  document_type: string;
  status: string;
  document_hash: string;
  signers: Signer[];
  inscription_txid: string | null;
  created_at: string;
  expires_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'text-zinc-500 bg-zinc-900', icon: FiEdit3 },
  pending: { label: 'Pending', color: 'text-amber-400 bg-amber-950', icon: FiClock },
  partially_signed: { label: 'Partial', color: 'text-blue-400 bg-blue-950', icon: FiEdit3 },
  completed: { label: 'Complete', color: 'text-green-400 bg-green-950', icon: FiCheck },
  expired: { label: 'Expired', color: 'text-red-400 bg-red-950', icon: FiAlertCircle },
};

export default function DocumentsPage() {
  const [created, setCreated] = useState<Envelope[]>([]);
  const [toSign, setToSign] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [sendModal, setSendModal] = useState<{
    envelopeId: string;
    signer: Signer;
  } | null>(null);

  useEffect(() => {
    const cookies = document.cookie.split('; ');
    const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
    if (handleCookie) {
      const h = handleCookie.split('=')[1];
      setHandle(h);
      fetchEnvelopes();
      fetchProfile(h);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchEnvelopes = async () => {
    try {
      const res = await fetch('/api/envelopes');
      const data = await res.json();
      setCreated(data.created || []);
      setToSign(data.to_sign || []);
    } catch (error) {
      console.error('Failed to fetch envelopes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (h: string) => {
    try {
      const res = await fetch(`/api/bitsign/signatures?handle=${h}`);
      const data = await res.json();
      if (data.identity?.avatar_url) {
        setAvatarUrl(data.identity.avatar_url);
      }
    } catch {
      // Avatar not critical
    }
  };

  const copySigningUrl = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getNextSigner = (signers: Signer[]): Signer | null => {
    const sorted = [...signers].sort((a, b) => a.order - b.order);
    return sorted.find(s => s.status !== 'signed') || null;
  };

  const totalCreated = created.length;
  const pendingSignatures = created.filter(e => e.status !== 'completed' && e.status !== 'expired').length;
  const completedCount = created.filter(e => e.status === 'completed').length;

  const renderEnvelopeRow = (envelope: Envelope, isActionRequired = false) => {
    const config = STATUS_CONFIG[envelope.status] || STATUS_CONFIG.pending;
    const StatusIcon = config.icon;
    const signedCount = envelope.signers.filter((s: any) => s.status === 'signed').length;
    const isExpanded = expandedId === envelope.id;
    const nextSigner = getNextSigner(envelope.signers);

    return (
      <div key={envelope.id} className={`border rounded-md ${isActionRequired ? 'border-amber-900/50' : 'border-zinc-900'} bg-black`}>
        <div
          className="group hover:bg-zinc-950 transition-colors p-5 grid md:grid-cols-12 gap-4 items-center relative cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : envelope.id)}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:bg-white transition-colors rounded-l-md" />

          <div className="md:col-span-1 text-zinc-600 group-hover:text-white transition-colors pl-2">
            <FiFileText size={18} />
          </div>

          <div className="md:col-span-4 space-y-0.5">
            <span className="text-sm font-medium text-white">{envelope.title}</span>
            <div className="text-xs text-zinc-500">{envelope.document_type.replace(/_/g, ' ')}</div>
          </div>

          <div className="md:col-span-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded ${config.color}`}>
              <StatusIcon size={10} />
              {config.label}
            </span>
          </div>

          <div className="md:col-span-2 text-right">
            <span className="text-sm text-zinc-500">{signedCount}/{envelope.signers.length} signed</span>
          </div>

          <div className="md:col-span-2 text-right flex items-center justify-end gap-2">
            {isActionRequired && nextSigner?.signing_token && (
              <Link
                href={`/sign/${nextSigner.signing_token}`}
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 bg-amber-500 text-black font-medium text-xs rounded-md hover:bg-amber-400 transition-all"
              >
                Sign Now
              </Link>
            )}
            {envelope.inscription_txid && !envelope.inscription_txid.startsWith('pending-') && (
              <a
                href={`https://whatsonchain.com/tx/${envelope.inscription_txid}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="w-8 h-8 border border-zinc-800 rounded-md flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all bg-black"
                title="View on blockchain"
              >
                <FiExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="md:col-span-1 flex justify-end">
            {isExpanded ? <FiChevronUp size={14} className="text-zinc-500" /> : <FiChevronDown size={14} className="text-zinc-500" />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-zinc-900 p-5 space-y-4 bg-zinc-950/50">
            <div className="space-y-2">
              <h4 className="text-xs text-zinc-500 font-medium">Signers</h4>
              {envelope.signers
                .sort((a: Signer, b: Signer) => a.order - b.order)
                .map((signer: Signer, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-900 last:border-0">
                  <div className="flex items-center gap-3">
                    {signer.status === 'signed' ? (
                      <FiCheck className="text-green-400" size={14} />
                    ) : (
                      <FiClock className="text-zinc-600" size={14} />
                    )}
                    <div>
                      <span className="text-sm font-medium">{signer.name}</span>
                      <span className="text-xs text-zinc-500 ml-2">{signer.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {signer.status === 'signed' ? (
                      <span className="text-xs text-green-400">
                        Signed {signer.signed_at ? new Date(signer.signed_at).toLocaleDateString() : ''}
                      </span>
                    ) : signer.signing_token ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSendModal({ envelopeId: envelope.id, signer });
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-md transition-all ${
                            signer.email_sent_at
                              ? 'border-green-900 text-green-600 bg-green-950/20'
                              : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-white bg-black'
                          }`}
                        >
                          {signer.email_sent_at ? (
                            <><FiCheck size={10} /> Sent</>
                          ) : (
                            <><FiMail size={10} /> Send</>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copySigningUrl(signer.signing_token!);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-md transition-all ${
                            copiedToken === signer.signing_token
                              ? 'border-green-700 text-green-400 bg-green-950/30'
                              : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-white bg-black'
                          }`}
                        >
                          {copiedToken === signer.signing_token ? (
                            <><FiCheck size={10} /> Copied</>
                          ) : (
                            <><FiCopy size={10} /> Copy Link</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                href={`/verify/${envelope.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-white text-xs rounded-md transition-all"
              >
                <FiShield size={10} /> Verify
              </Link>

              {envelope.status === 'completed' && (
                <a
                  href={`/api/envelopes/${envelope.id}/pdf`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-white text-xs rounded-md transition-all"
                >
                  <FiFileText size={10} /> Download PDF
                </a>
              )}

              <span className="font-mono text-xs text-zinc-600 ml-auto">
                {envelope.document_hash.slice(0, 16)}...
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleEmailSent = () => {
    fetchEnvelopes();
    setSendModal(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white animate-spin rounded-full opacity-20" />
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-bold mb-4 tracking-tight">Please sign in</h1>
        <p className="text-zinc-400 mb-8 max-w-md text-base leading-relaxed">
          Connect your HandCash wallet to access your documents.
        </p>
        <a
          href="/api/auth/handcash?returnTo=/user/account/advanced"
          className="px-8 py-3 bg-white text-black font-medium rounded-md transition-all hover:bg-zinc-200 text-sm"
        >
          Sign in with HandCash
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-4 sm:p-6 pt-20 sm:pt-24 max-w-6xl mx-auto space-y-8 sm:space-y-12 pb-40">
        {/* Back Link + Header */}
        <div className="space-y-6">
          <Link href="/user/account" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
            <FiArrowLeft size={14} /> Back to Account
          </Link>

          <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-900 pb-6 sm:pb-8 gap-4 sm:gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-black border border-zinc-800 flex items-center justify-center text-2xl rounded-lg shrink-0 relative overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={handle} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-500">&#128100;</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">${handle}</h1>
                <p className="text-zinc-500 text-sm mt-1">Document Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/user/documents/new"
                className="px-6 py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2"
              >
                <FiPlus /> New Document
              </Link>
              <label className="relative group cursor-pointer">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      window.location.href = '/user/documents/new';
                    }
                  }}
                  accept=".pdf,.doc,.docx,.txt,.html"
                />
                <div className="px-5 py-3 border border-zinc-800 bg-black text-zinc-400 text-sm font-medium rounded-md group-hover:text-white group-hover:border-zinc-600 transition-all flex items-center gap-2">
                  <FiUpload size={14} /> Upload & Sign
                </div>
              </label>
            </div>
          </header>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-px bg-zinc-900 border border-zinc-900 rounded-md overflow-hidden">
          <div className="bg-black p-5">
            <span className="block text-xs text-zinc-500 mb-1">Documents Created</span>
            <span className="block text-2xl font-semibold text-white">{totalCreated}</span>
          </div>
          <div className="bg-black p-5">
            <span className="block text-xs text-zinc-500 mb-1">Pending Signatures</span>
            <span className="block text-2xl font-semibold text-amber-400">{pendingSignatures}</span>
          </div>
          <div className="bg-black p-5">
            <span className="block text-xs text-zinc-500 mb-1">Completed</span>
            <span className="block text-2xl font-semibold text-green-400">{completedCount}</span>
          </div>
        </div>

        {/* Action Required */}
        {toSign.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-amber-500 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" /> Action Required ({toSign.length})
            </h3>
            <div className="space-y-2">
              {toSign.map(e => renderEnvelopeRow(e, true))}
            </div>
          </section>
        )}

        {/* Your Documents */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full" /> Your Documents ({created.length})
          </h3>
          {created.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-md text-center">
              <FiFileText className="text-zinc-700 text-3xl mb-4" />
              <p className="text-base text-zinc-400 font-medium">No documents yet</p>
              <p className="text-sm text-zinc-600 mt-1">
                Create your first signing envelope to get started.
              </p>
              <Link
                href="/user/documents/new"
                className="mt-6 px-6 py-2.5 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2"
              >
                <FiPlus size={14} /> New Document
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {created.map(e => renderEnvelopeRow(e))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="pt-16 border-t border-zinc-900">
          <p className="text-[11px] tracking-[0.25em] uppercase text-zinc-700 text-center">
            A Bitcoin Corporation Product
          </p>
        </footer>
      </div>

      {/* Send Email Modal */}
      {sendModal && (
        <SendEmailModal
          isOpen={true}
          onClose={() => setSendModal(null)}
          onSent={handleEmailSent}
          envelopeId={sendModal.envelopeId}
          signerName={sendModal.signer.name}
          signerRole={sendModal.signer.role}
          signerEmail={sendModal.signer.email}
          signingToken={sendModal.signer.signing_token!}
        />
      )}
    </div>
  );
}
