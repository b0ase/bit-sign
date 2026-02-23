'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SovereignSignature from '@/components/SovereignSignature';
import {
  FiCheck, FiClock, FiAlertCircle, FiFileText,
  FiEdit3, FiShield, FiExternalLink
} from 'react-icons/fi';

interface EnvelopeData {
  id: string;
  title: string;
  document_type: string;
  status: string;
  document_html: string;
  document_hash: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
}

interface SignerData {
  name: string;
  role: string;
  order: number;
  status: string;
  signed_at: string | null;
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<EnvelopeData | null>(null);
  const [signer, setSigner] = useState<SignerData | null>(null);
  const [allSigners, setAllSigners] = useState<SignerData[]>([]);
  const [showSignature, setShowSignature] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signResult, setSignResult] = useState<any>(null);

  useEffect(() => {
    if (token) resolveToken();
  }, [token]);

  const resolveToken = async () => {
    try {
      const res = await fetch(`/api/envelopes/resolve?token=${token}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setEnvelope(data.envelope);
        setSigner(data.signer);
        setAllSigners(data.all_signers);
      }
    } catch (err) {
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (signatureData: { svg: string; json: string }) => {
    if (!envelope) return;
    setSigning(true);
    setShowSignature(false);

    try {
      const res = await fetch(`/api/envelopes/${envelope.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signing_token: token,
          signature_type: 'drawn',
          signature_data: signatureData.svg,
          signer_name: signer?.name,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSignResult(data);
      } else {
        setError(data.error || 'Signing failed');
      }
    } catch (err) {
      setError('Failed to submit signature');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white animate-spin opacity-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <FiAlertCircle className="text-red-500 text-4xl mb-6" />
        <h1 className="text-3xl font-mono font-black mb-4 tracking-tighter uppercase italic">Error</h1>
        <p className="text-zinc-500 font-mono text-sm">{error}</p>
      </div>
    );
  }

  if (signResult) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-lg space-y-8">
          <FiCheck className="mx-auto text-green-400" size={48} />
          <h1 className="text-4xl font-mono font-black tracking-tighter uppercase italic">Signed</h1>
          <p className="text-zinc-500 font-mono text-[10px] tracking-[0.4em] uppercase">
            Your signature has been recorded for this document.
          </p>

          {signResult.all_signed && (
            <div className="p-6 border border-green-900 bg-green-950/20 space-y-3">
              <FiShield className="mx-auto text-green-400" size={24} />
              <p className="font-mono text-xs text-green-400 uppercase tracking-widest">All Parties Have Signed</p>
              {signResult.inscription_txid && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Blockchain Proof</p>
                  <a
                    href={signResult.explorer_url}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-white font-mono text-xs hover:underline"
                  >
                    {signResult.inscription_txid.slice(0, 20)}... <FiExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}

          {!signResult.all_signed && (
            <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
              Waiting for other signers to complete.
            </p>
          )}

          <Link
            href={`/verify/${envelope?.id}`}
            className="inline-block px-8 py-3 bg-white text-black font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all"
          >
            View Document Status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-6 pt-24 max-w-4xl mx-auto space-y-8 pb-40">
        {/* Header */}
        <header className="border-b border-zinc-900 pb-6 space-y-2">
          <div className="flex items-center gap-3">
            <FiFileText className="text-zinc-600" size={20} />
            <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-[0.4em]">
              Signing Request
            </p>
          </div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase italic">{envelope?.title}</h1>
          <div className="flex gap-6 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
            <span>From: ${envelope?.created_by}</span>
            <span>Hash: {envelope?.document_hash.slice(0, 16)}...</span>
          </div>
        </header>

        {/* Signer Info */}
        <div className="p-4 border border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div>
            <span className="block font-mono text-xs font-bold uppercase tracking-widest text-white">{signer?.name}</span>
            <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{signer?.role}</span>
          </div>
          {signer?.status === 'signed' ? (
            <span className="px-4 py-2 text-green-400 bg-green-950 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
              <FiCheck size={12} /> Already Signed
            </span>
          ) : (
            <span className="px-4 py-2 text-amber-400 bg-amber-950 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
              <FiClock size={12} /> Awaiting Signature
            </span>
          )}
        </div>

        {/* Signers Progress */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {allSigners.map((s, i) => (
            <div
              key={i}
              className={`p-3 border text-center ${
                s.status === 'signed'
                  ? 'border-green-900 bg-green-950/10'
                  : 'border-zinc-900 bg-zinc-950'
              }`}
            >
              <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{s.role}</span>
              <span className="block font-mono text-xs font-bold uppercase tracking-widest mt-1">{s.name || 'Pending'}</span>
              {s.status === 'signed' && <FiCheck className="mx-auto mt-1 text-green-400" size={12} />}
            </div>
          ))}
        </div>

        {/* Document Preview */}
        {envelope?.document_html && (
          <div className="border border-zinc-800 p-1">
            <div className="bg-white text-black p-8 overflow-y-auto max-h-[600px]">
              <div dangerouslySetInnerHTML={{ __html: envelope.document_html }} />
            </div>
          </div>
        )}

        {/* Sign Button */}
        {signer?.status !== 'signed' && (
          <div className="pt-4">
            <button
              onClick={() => setShowSignature(true)}
              className="w-full py-4 bg-white text-black font-mono font-black uppercase text-sm tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-3"
            >
              <FiEdit3 /> Sign Document
            </button>
            <p className="text-center font-mono text-[10px] text-zinc-600 uppercase tracking-widest mt-3">
              By signing, you confirm you have reviewed and agree to this document.
            </p>
          </div>
        )}

        {/* Signature Modal */}
        {showSignature && (
          <SovereignSignature
            onSave={handleSign}
            onCancel={() => setShowSignature(false)}
          />
        )}

        {/* Processing Overlay */}
        {signing && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-8">
              <div className="w-16 h-16 border-t-2 border-white animate-spin rounded-full opacity-30" />
              <div className="text-center space-y-2">
                <span className="block font-mono text-sm text-white font-black uppercase tracking-[0.5em] italic">Signing</span>
                <span className="block font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Recording signature on blockchain...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
