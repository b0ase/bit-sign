'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertCircle, FiLoader, FiExternalLink } from 'react-icons/fi';
import { useUserHandle } from '@/hooks/useUserHandle';

interface WalletInfo {
  type: 'handcash' | 'metamask' | 'phantom';
  address: string;
  displayName?: string;
}

interface WalletSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignComplete: (result: {
    walletType: string;
    walletAddress: string;
    signature: string;
    message: string;
  }) => void;
  message: string;
  title?: string;
}

export function WalletSigningModal({
  isOpen,
  onClose,
  onSignComplete,
  message,
  title = 'Verify with Wallet',
}: WalletSigningModalProps) {
  const [step, setStep] = useState<'select' | 'connecting' | 'signing' | 'success' | 'error'>('select');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  // Check for HandCash auth
  const { handle: handcashHandle } = useUserHandle();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedWallet(null);
      setWalletInfo(null);
      setError(null);
      setSignature(null);
    }
  }, [isOpen]);

  // Check available wallets
  const [availableWallets, setAvailableWallets] = useState<{
    handcash: boolean;
    metamask: boolean;
    phantom: boolean;
  }>({ handcash: false, metamask: false, phantom: false });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setAvailableWallets({
      handcash: !!handcashHandle, // HandCash is available if user has auth token
      metamask: !!(window as any).ethereum?.isMetaMask,
      phantom: !!(window as any).solana?.isPhantom,
    });
  }, [handcashHandle]);

  // Connect to wallet
  const connectWallet = async (walletType: string) => {
    setSelectedWallet(walletType);
    setStep('connecting');
    setError(null);

    try {
      let address = '';
      let displayName = '';

      if (walletType === 'metamask') {
        const ethereum = (window as any).ethereum;
        if (!ethereum?.isMetaMask) {
          throw new Error('MetaMask not installed');
        }

        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
        displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;

        setWalletInfo({ type: 'metamask', address, displayName });
        setStep('signing');
        await signMessage(walletType, address);

      } else if (walletType === 'phantom') {
        const solana = (window as any).solana;
        if (!solana?.isPhantom) {
          throw new Error('Phantom not installed');
        }

        const resp = await solana.connect();
        address = resp.publicKey.toString();
        displayName = `${address.slice(0, 4)}...${address.slice(-4)}`;

        setWalletInfo({ type: 'phantom', address, displayName });
        setStep('signing');
        await signMessage(walletType, address);

      } else if (walletType === 'handcash') {
        // HandCash uses server-side verification
        await verifyWithHandCash();
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setStep('error');
    }
  };

  // Verify with HandCash (server-side)
  const verifyWithHandCash = async () => {
    try {
      setStep('signing');

      const response = await fetch('/api/bitsign/handcash-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          // Redirect to HandCash auth
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.href = `/api/auth/handcash?returnTo=${returnUrl}`;
          return;
        }
        throw new Error(data.error || 'HandCash verification failed');
      }

      setWalletInfo({
        type: 'handcash',
        address: data.walletAddress,
        displayName: data.displayName || data.walletAddress,
      });
      setSignature(data.signature);
      setStep('success');

      // Notify parent after short delay
      setTimeout(() => {
        onSignComplete({
          walletType: 'handcash',
          walletAddress: data.walletAddress,
          signature: data.signature,
          message,
        });
      }, 1000);

    } catch (err) {
      console.error('HandCash verification error:', err);
      setError(err instanceof Error ? err.message : 'HandCash verification failed');
      setStep('error');
    }
  };

  // Redirect to HandCash OAuth
  const connectHandCash = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/api/auth/handcash?returnTo=${returnUrl}`;
  };

  // Sign message with wallet (MetaMask/Phantom)
  const signMessage = async (walletType: string, address: string) => {
    try {
      let sig = '';

      if (walletType === 'metamask') {
        const ethereum = (window as any).ethereum;
        sig = await ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });
      } else if (walletType === 'phantom') {
        const solana = (window as any).solana;
        const encodedMessage = new TextEncoder().encode(message);
        const signedMessage = await solana.signMessage(encodedMessage, 'utf8');
        sig = Buffer.from(signedMessage.signature).toString('base64');
      }

      setSignature(sig);
      setStep('success');

      // Notify parent after short delay
      setTimeout(() => {
        onSignComplete({
          walletType,
          walletAddress: address,
          signature: sig,
          message,
        });
      }, 1000);
    } catch (err) {
      console.error('Signing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign message');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'select' && (
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm">
                  Select a wallet to verify your identity by signing a message.
                </p>

                <div className="space-y-2">
                  {/* HandCash - Priority option */}
                  {handcashHandle ? (
                    <button
                      onClick={() => connectWallet('handcash')}
                      className="w-full flex items-center gap-4 p-4 bg-green-900/20 hover:bg-green-900/30 border border-green-700/50 rounded-lg transition-colors"
                    >
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                        H
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white">HandCash</div>
                        <div className="text-xs text-green-400">
                          Connected as ${handcashHandle}
                        </div>
                      </div>
                      <FiCheck className="text-green-400" />
                    </button>
                  ) : (
                    <button
                      onClick={connectHandCash}
                      className="w-full flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                    >
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                        H
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white">HandCash</div>
                        <div className="text-xs text-zinc-500">Click to connect</div>
                      </div>
                      <FiExternalLink className="text-zinc-500" size={16} />
                    </button>
                  )}

                  {/* MetaMask */}
                  <button
                    onClick={() => connectWallet('metamask')}
                    disabled={!availableWallets.metamask}
                    className="w-full flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                      M
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white">MetaMask</div>
                      <div className="text-xs text-zinc-500">
                        {availableWallets.metamask ? 'Ethereum Wallet' : 'Not installed'}
                      </div>
                    </div>
                  </button>

                  {/* Phantom */}
                  <button
                    onClick={() => connectWallet('phantom')}
                    disabled={!availableWallets.phantom}
                    className="w-full flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                      P
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white">Phantom</div>
                      <div className="text-xs text-zinc-500">
                        {availableWallets.phantom ? 'Solana Wallet' : 'Not installed'}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Message preview */}
                <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-500 font-mono max-h-32 overflow-auto">
                  <div className="text-zinc-400 mb-1">Message to sign:</div>
                  <pre className="whitespace-pre-wrap">{message}</pre>
                </div>
              </div>
            )}

            {step === 'connecting' && (
              <div className="text-center py-8">
                <FiLoader className="w-12 h-12 text-zinc-400 animate-spin mx-auto mb-4" />
                <p className="text-white font-medium">Connecting to {selectedWallet}...</p>
                <p className="text-zinc-500 text-sm mt-1">Please approve in your wallet</p>
              </div>
            )}

            {step === 'signing' && (
              <div className="text-center py-8">
                <FiLoader className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                <p className="text-white font-medium">
                  {selectedWallet === 'handcash' ? 'Verifying with HandCash...' : 'Signing message...'}
                </p>
                <p className="text-zinc-500 text-sm mt-1">
                  {selectedWallet === 'handcash'
                    ? 'Confirming your identity'
                    : 'Please confirm the signature in your wallet'
                  }
                </p>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheck className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-white font-medium">Signature verified!</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Wallet: {walletInfo?.displayName || walletInfo?.address}
                </p>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiAlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-white font-medium">Verification failed</p>
                <p className="text-red-400 text-sm mt-1">{error}</p>

                <button
                  onClick={() => setStep('select')}
                  className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default WalletSigningModal;
