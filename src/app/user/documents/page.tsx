'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiFileText, FiPlus, FiClock, FiCheck, FiAlertCircle,
  FiExternalLink, FiEdit3
} from 'react-icons/fi';

interface Envelope {
  id: string;
  title: string;
  document_type: string;
  status: string;
  document_hash: string;
  signers: any[];
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

  useEffect(() => {
    const cookies = document.cookie.split('; ');
    const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
    if (handleCookie) {
      const h = handleCookie.split('=')[1];
      setHandle(h);
      fetchEnvelopes();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white animate-spin opacity-20" />
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-mono font-black mb-6 tracking-tighter uppercase italic">Access Denied</h1>
        <p className="text-zinc-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-10">
          Connect your HandCash wallet to manage documents.
        </p>
        <Link href="/api/auth/handcash" className="px-12 py-4 bg-white text-black font-mono font-bold uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all">
          Connect Wallet
        </Link>
      </div>
    );
  }

  const renderEnvelopeRow = (envelope: Envelope) => {
    const config = STATUS_CONFIG[envelope.status] || STATUS_CONFIG.pending;
    const StatusIcon = config.icon;
    const signedCount = envelope.signers.filter((s: any) => s.status === 'signed').length;

    return (
      <div key={envelope.id} className="group border border-zinc-900 bg-black hover:bg-zinc-950 transition-colors p-6 grid md:grid-cols-12 gap-4 items-center relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:bg-white transition-colors" />

        <div className="md:col-span-1 text-zinc-600 group-hover:text-white transition-colors">
          <FiFileText size={20} />
        </div>

        <div className="md:col-span-4 space-y-1">
          <Link href={`/verify/${envelope.id}`} className="font-mono font-black text-sm uppercase tracking-wider text-white hover:underline">
            {envelope.title}
          </Link>
          <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
            {envelope.document_type.replace(/_/g, ' ')}
          </div>
        </div>

        <div className="md:col-span-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase tracking-widest ${config.color}`}>
            <StatusIcon size={10} />
            {config.label}
          </span>
        </div>

        <div className="md:col-span-2 text-right">
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
            {signedCount}/{envelope.signers.length} signed
          </span>
        </div>

        <div className="md:col-span-2 text-right">
          <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
            {new Date(envelope.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="md:col-span-1 flex justify-end">
          {envelope.inscription_txid && !envelope.inscription_txid.startsWith('pending-') && (
            <a
              href={`https://whatsonchain.com/tx/${envelope.inscription_txid}`}
              target="_blank"
              className="w-8 h-8 border border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all bg-black"
              title="View on blockchain"
            >
              <FiExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-6 pt-24 max-w-6xl mx-auto space-y-12 pb-40">
        {/* Header */}
        <header className="flex items-end justify-between border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-5xl font-mono font-black tracking-tighter uppercase italic">Documents</h1>
            <p className="text-zinc-600 font-mono text-[10px] tracking-[0.4em] uppercase mt-2">
              Blockchain-Verified Signing Envelopes
            </p>
          </div>
          <Link
            href="/user/documents/new"
            className="px-8 py-4 bg-white text-black font-mono font-black uppercase text-xs tracking-[0.2em] hover:bg-zinc-200 transition-all flex items-center gap-3"
          >
            <FiPlus /> New Document
          </Link>
        </header>

        {/* Created Envelopes */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-2">
            <span className="w-1 h-1 bg-white" /> Created by You
          </h3>
          {created.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center border border-dashed border-zinc-900 text-center">
              <FiFileText className="text-zinc-800 text-4xl mb-4" />
              <p className="font-mono text-sm text-zinc-500 uppercase tracking-[0.2em] font-bold">No documents yet</p>
              <p className="font-mono text-xs text-zinc-700 uppercase tracking-widest mt-2">
                Create your first signing envelope.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {created.map(renderEnvelopeRow)}
            </div>
          )}
        </section>

        {/* To Sign */}
        {toSign.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-amber-500 flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-500" /> Needs Your Signature
            </h3>
            <div className="space-y-2">
              {toSign.map(renderEnvelopeRow)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
