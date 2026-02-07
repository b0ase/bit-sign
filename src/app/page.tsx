'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiEdit3, FiFileText, FiShield, FiCheck, FiPlus, FiArrowRight, FiUser, FiZap, FiLock } from 'react-icons/fi';
import Link from 'next/link';
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
    <main className="min-h-screen text-white font-mono selection:bg-white selection:text-black">

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <div className="mb-12 p-8 bg-zinc-900/50 border border-white/[0.05] shadow-2xl backdrop-blur-sm">
              <img src="/bit-sign-icon.png" alt="Bit-Sign Icon" className="w-24 h-24 filter grayscale invert" />
            </div>

            <div className="inline-flex items-center gap-3 px-6 py-2 bg-zinc-950 border border-white/[0.03] text-[10px] uppercase tracking-[0.6em] text-zinc-500 mb-12 font-mono">
              <FiShield className="text-zinc-400" />
              Digital DNA // Multi-factor Attestation
            </div>

            <h1 className="text-8xl md:text-[12rem] font-black uppercase tracking-tighter mb-12 italic leading-none">
              BIT<span className="text-zinc-900">.</span>SIGN
            </h1>

            <p className="text-sm md:text-lg text-zinc-500 uppercase tracking-[0.5em] max-w-4xl leading-relaxed mb-20 font-mono">
              The industrial-grade verification layer for humans and agents.
              <span className="block mt-4 text-zinc-700">Tokenise your identity via HandCash and supplementary biological proof.</span>
            </p>

            <div className="flex flex-wrap justify-center gap-12">
              {handle ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-[0.4em] font-mono">Authenticated as // <span className="text-white">${handle}</span></div>
                  <Link
                    href="/user/account"
                    className="group relative px-16 py-6 bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] transition-all hover:bg-zinc-200"
                  >
                    <span className="relative z-10 flex items-center gap-4">
                      <FiUser className="w-4 h-4" />
                      Access Digital DNA Dashboard
                    </span>
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="group relative px-16 py-6 bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] transition-all hover:bg-zinc-200"
                >
                  <span className="relative z-10 flex items-center gap-4">
                    <FiZap className="w-4 h-4" />
                    Initialize Identity Handshake
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats/Industrial Row */}
      <section className="border-y border-white/[0.03] bg-zinc-950/30 py-20 px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-24">
          {[
            { label: 'Network Throughput', val: 'Instant Attestation' },
            { label: 'Proof Standard', val: 'Multi-Factor / Verifiable' },
            { label: 'SaaS Fee / Attest', val: '0.01 USD' }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-4">
              <div className="text-[10px] text-zinc-600 uppercase tracking-[0.4em] font-mono">{stat.label}</div>
              <div className="text-3xl font-black italic uppercase tracking-tighter text-white">{stat.val}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SaaS Feature Grid */}
      <section className="py-40 px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-1px bg-white/[0.03] border border-white/[0.03]">
          {[
            {
              icon: FiEdit3,
              title: "GitHub Verification",
              desc: "Sign every commit with your HandCash identity. Real-time notifications for developer authorship."
            },
            {
              icon: FiLock,
              title: "IP Registration",
              desc: "Anchor your creative intent and intellectual property on-chain. Permanent, verifiable proof of state."
            },
            {
              icon: FiShield,
              title: "Token Registry",
              desc: "Associate your identity with shareholder tokens and registers of members. Staked verification model."
            }
          ].map((item, i) => (
            <div key={i} className="p-16 bg-[#050505] hover:bg-zinc-900/20 transition-all group space-y-12">
              <div className="w-12 h-12 border border-white/5 flex items-center justify-center text-zinc-800 group-hover:text-white transition-colors">
                <item.icon size={24} />
              </div>
              <div className="space-y-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">{item.title}</h3>
                <p className="text-zinc-600 text-[10px] leading-relaxed uppercase tracking-[0.2em] font-mono group-hover:text-zinc-400 transition-colors">
                  {item.desc}
                </p>
              </div>
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
