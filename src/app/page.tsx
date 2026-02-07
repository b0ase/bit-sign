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
    <main className="min-h-screen bg-black text-white font-mono selection:bg-zinc-800 selection:text-white overflow-hidden">

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-8 bg-black">
        {/* Armored Glass Reflection Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/20 to-black pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <div className="mb-16 p-6 bg-black border border-zinc-800/60 shadow-[0_0_50px_-12px_rgba(255,255,255,0.05)] rounded-sm">
              <img src="/bit-sign-icon.png" alt="Bit-Sign Icon" className="w-20 h-20 filter grayscale contrast-125 brightness-75" />
            </div>

            <div className="inline-flex items-center gap-3 px-8 py-3 bg-black border border-zinc-800 text-[10px] uppercase tracking-[0.5em] text-zinc-400 mb-16 font-mono shadow-xl">
              <FiShield className="text-zinc-600" />
              Sovereignty as a Service
            </div>

            <h1 className="text-8xl md:text-[13rem] font-black uppercase tracking-tighter mb-12 italic leading-none text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 to-zinc-800 drop-shadow-2xl">
              BIT<span className="text-zinc-800">.</span>SIGN
            </h1>

            <p className="text-xs md:text-sm text-zinc-600 uppercase tracking-[0.4em] max-w-3xl leading-loose mb-24 font-mono border-l-2 border-zinc-900 pl-6 text-left md:text-center md:border-l-0 md:pl-0">
              The industrial-grade signing layer for the $402 narrative economy.
              <span className="block mt-4 text-zinc-500">Immutable proof of intent for humans and AI agents.</span>
            </p>

            <div className="flex flex-wrap justify-center gap-12">
              {handle ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="text-[9px] text-zinc-700 uppercase tracking-[0.3em] font-mono">Authenticated // <span className="text-zinc-300">${handle}</span></div>
                  <Link
                    href="/user/account"
                    className="group relative px-12 py-5 bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-zinc-400 font-black uppercase tracking-[0.25em] text-[10px] transition-all duration-500"
                  >
                    <span className="relative z-10 flex items-center gap-4 group-hover:text-white transition-colors">
                      <FiUser className="w-4 h-4" />
                      Access Dashboard
                    </span>
                    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="group relative px-16 py-6 bg-white text-black font-black uppercase tracking-[0.25em] text-[11px] transition-all hover:bg-zinc-200 outline outline-4 outline-zinc-900/50 hover:outline-zinc-800"
                >
                  <span className="relative z-10 flex items-center gap-4">
                    <FiZap className="w-4 h-4 text-black" />
                    Initialize with HandCash
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats/Industrial Row - "The Beast" Dashboard styling */}
      <section className="border-y border-zinc-900 bg-black py-24 px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]"></div>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-y-16 gap-x-24 relative z-10">
          {[
            { label: 'Network Speed', val: '0.2s Confirmation' },
            { label: 'Signature ID', val: 'BSV-Ordinal Standard' },
            { label: 'SaaS Fee', val: '$0.01 / Sign' }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-4 border-l border-zinc-900/50 pl-8">
              <div className="text-[9px] text-zinc-700 uppercase tracking-[0.35em] font-mono">{stat.label}</div>
              <div className="text-2xl font-black italic uppercase tracking-wider text-white font-mono">{stat.val}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SaaS Feature Grid - Black on Black */}
      <section className="py-40 px-8 bg-black">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 bg-zinc-900/20 border border-zinc-900">
          {[
            {
              icon: FiEdit3,
              title: "GitHub Link",
              desc: "Cryptographically sign every commit. Verify developer authorship on-chain."
            },
            {
              icon: FiLock,
              title: "IP Anchor",
              desc: "Secure your intellectual property in a sovereign vault. Permanent state."
            },
            {
              icon: FiShield,
              title: "Token Registry",
              desc: "Associate identity with shareholder tokens. Staked verification model."
            }
          ].map((item, i) => (
            <div key={i} className="p-16 border-r border-b border-zinc-900 bg-black hover:bg-zinc-950 transition-all group space-y-10 relative">
              <div className="absolute top-8 right-8 text-zinc-900 group-hover:text-zinc-800 transition-colors">
                <item.icon size={64} className="opacity-20" />
              </div>
              <div className="w-10 h-10 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:border-zinc-600 transition-all">
                <item.icon size={18} />
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-black uppercase tracking-tight italic text-zinc-300 group-hover:text-white transition-colors">{item.title}</h3>
                <p className="text-zinc-600 text-[10px] leading-relaxed uppercase tracking-[0.2em] font-mono group-hover:text-zinc-500 transition-colors">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-900 bg-black py-24 px-8 text-center">
        <div className="text-[9px] text-zinc-800 uppercase tracking-[0.6em] font-bold">
          © 2026 BIT-SIGN SYSTEM // $402
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
