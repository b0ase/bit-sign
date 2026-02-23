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
    <main className="min-h-screen bg-black text-white selection:bg-zinc-800 selection:text-white overflow-hidden">

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-8 bg-black">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <div className="mb-12 p-6 bg-black border border-zinc-800/60 shadow-[0_0_50px_-12px_rgba(255,255,255,0.05)] rounded-md">
              <img src="/bit-sign-icon.png" alt="Bit-Sign Icon" className="w-20 h-20 filter grayscale contrast-125 brightness-75" />
            </div>

            <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-black border border-zinc-800 text-sm text-zinc-400 mb-12 rounded-md">
              <FiShield className="text-zinc-500" />
              Document Signing on Bitcoin
            </div>

            <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-none text-white">
              Bit-Sign
            </h1>

            <p className="text-base md:text-lg text-zinc-400 max-w-2xl leading-relaxed mb-16">
              Sign documents with blockchain-verified proof. Every signature is permanently recorded on-chain &mdash; immutable, instant, and verifiable by anyone.
            </p>

            <div className="flex flex-wrap justify-center gap-6">
              {handle ? (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-zinc-500">Signed in as <span className="text-white font-medium">${handle}</span></p>
                  <Link
                    href="/user/account"
                    className="group px-8 py-3 bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 font-medium text-sm rounded-md transition-all flex items-center gap-3"
                  >
                    <FiUser className="w-4 h-4" />
                    Go to Dashboard
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="px-10 py-4 bg-white text-black font-semibold text-sm rounded-md transition-all hover:bg-zinc-200 flex items-center gap-3"
                >
                  <FiZap className="w-4 h-4 text-black" />
                  Sign in with HandCash
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="border-y border-zinc-900 bg-black py-16 px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-y-12 gap-x-16">
          {[
            { label: 'Confirmation Speed', val: '0.2 seconds' },
            { label: 'Signature Standard', val: 'BSV Ordinal' },
            { label: 'Cost per Signature', val: '$0.01' }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-2 border-l border-zinc-800 pl-6">
              <span className="text-sm text-zinc-500">{stat.label}</span>
              <span className="text-2xl font-semibold text-white">{stat.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-32 px-8 bg-black">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 border border-zinc-900 rounded-md overflow-hidden">
          {[
            {
              icon: FiEdit3,
              title: "GitHub Signing",
              desc: "Cryptographically sign every commit. Verify developer authorship on the blockchain."
            },
            {
              icon: FiLock,
              title: "IP Protection",
              desc: "Anchor your intellectual property with permanent, timestamped proof of ownership."
            },
            {
              icon: FiShield,
              title: "Token Registry",
              desc: "Link identity to shareholder tokens with staked, on-chain verification."
            }
          ].map((item, i) => (
            <div key={i} className="p-10 border-r border-b border-zinc-900 bg-black hover:bg-zinc-950 transition-all group space-y-6 relative last:border-r-0">
              <div className="w-10 h-10 border border-zinc-800 rounded-md flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:border-zinc-600 transition-all">
                <item.icon size={18} />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-200 group-hover:text-white transition-colors">{item.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-900 bg-black py-16 px-8 text-center">
        <p className="text-sm text-zinc-600">
          &copy; 2026 Bit-Sign
        </p>
      </footer>

      {/* Modals */}
      <WalletSigningModal
        isOpen={isSigningModalOpen}
        onClose={() => setIsSigningModalOpen(false)}
        message="BIT-SIGN ATTESTATION: I hereby authorize the inscription of this record on the BSV blockchain."
        onSignComplete={(res) => {
          console.log('Signature Complete:', res);
          setIsSigningModalOpen(false);
        }}
      />
    </main>
  );
}
