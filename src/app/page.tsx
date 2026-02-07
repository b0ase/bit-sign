'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiEdit3, FiFileText, FiShield, FiCheck, FiPlus, FiArrowRight, FiUser, FiZap, FiLock } from 'react-icons/fi';
import { SignatureDisplay, WalletSigningModal } from '@/components/bitsign';
import { useUserHandle } from '@/hooks/useUserHandle';

export default function BitSignPage() {
  const { handle, loading: authLoading } = useUserHandle();
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [signatures, setSignatures] = useState<any[]>([]);

  const handleLogin = () => {
    window.location.href = '/api/auth/handcash';
  };

  return (
    <main className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black selection:text-black">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 border border-zinc-900 text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-8">
              <FiShield className="text-blue-500" />
              Sovereignty as a Service
            </div>

            <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter mb-8 italic">
              BIT<span className="text-zinc-800">.SIGN</span>
            </h1>

            <p className="text-lg text-zinc-500 uppercase tracking-widest max-w-3xl leading-relaxed mb-12">
              The industrial-grade signing layer for the $402 narrative economy.
              Immutable proof of intent for humans and AI agents.
            </p>

            <div className="flex flex-wrap justify-center gap-6">
              {handle ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-xs text-zinc-600 uppercase tracking-widest">Authenticated as <span className="text-white">${handle}</span></div>
                  <button
                    onClick={() => setIsSigningModalOpen(true)}
                    className="group relative px-12 py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs transition-all hover:bg-blue-500 hover:text-white"
                  >
                    <span className="relative z-10 flex items-center gap-3">
                      <FiEdit3 className="w-4 h-4" />
                      Create New Attestation
                    </span>
                    <div className="absolute inset-0 bg-blue-500 translate-x-2 translate-y-2 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="group relative px-12 py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs transition-all hover:bg-green-500 hover:text-white"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <FiZap className="w-4 h-4" />
                    Initialize with HandCash
                  </span>
                  <div className="absolute inset-0 bg-green-500 translate-x-2 translate-y-2 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats/Industrial Row */}
      <section className="border-y border-zinc-900 bg-zinc-950/50 py-12 px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Network Speed</div>
            <div className="text-2xl font-bold italic">0.2s Confirmation</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Signature ID</div>
            <div className="text-2xl font-bold italic">BSV-Ordinal Standard</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest">SaaS Fee</div>
            <div className="text-2xl font-bold italic">$0.01 / Sign</div>
          </div>
        </div>
      </section>

      {/* SaaS Feature Grid */}
      <section className="py-24 px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: FiLock,
              title: "IP Registration",
              desc: "Permanently record your creative intent on-chain. Ideal for Kintsugi AI projects."
            },
            {
              icon: FiShield,
              title: "Provable Identity",
              desc: "Signatures are tied directly to your $handle, providing unforgeable proof of authorship."
            },
            {
              icon: FiZap,
              title: "Instant Inscriptions",
              desc: "Every signed document is inscribed as a 1-sat ordinal for permanent availability."
            }
          ].map((item, i) => (
            <div key={i} className="p-10 bg-zinc-900/30 border border-zinc-900 hover:border-zinc-700 transition-colors group">
              <item.icon className="w-8 h-8 text-zinc-700 group-hover:text-blue-500 mb-8 transition-colors" />
              <h3 className="text-xl font-bold uppercase tracking-tight mb-4 italic">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-wider">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-900 py-20 px-8 text-center">
        <div className="text-[10px] text-zinc-600 uppercase tracking-[0.5em]">
          © 2026 BIT-SIGN — A $402 INFRASTRUCTURE ENTITY
        </div>
      </footer>

      {/* Modals */}
      <WalletSigningModal
        isOpen={isSigningModalOpen}
        onClose={() => setIsSigningModalOpen(false)}
        message="BIT-SIGN ATTESTATION: I hereby authorize the inscription of this record on the BSV blockchain."
        onSignComplete={(res) => {
          console.log('Signature Complete:', res);
          setIsSigningModalOpen(false);
          // Here we would trigger the actual inscription
        }}
      />
    </main>
  );
}
