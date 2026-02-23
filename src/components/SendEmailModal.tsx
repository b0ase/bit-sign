'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertCircle, FiLoader, FiSend, FiMail } from 'react-icons/fi';

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
  envelopeId: string;
  signerName: string;
  signerRole: string;
  signerEmail?: string | null;
  signingToken: string;
}

type ModalStep = 'compose' | 'sending' | 'sent' | 'error';

export function SendEmailModal({
  isOpen,
  onClose,
  onSent,
  envelopeId,
  signerName,
  signerRole,
  signerEmail,
  signingToken,
}: SendEmailModalProps) {
  const [step, setStep] = useState<ModalStep>('compose');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('compose');
      setEmail(signerEmail || '');
      setMessage('');
      setError(null);
    }
  }, [isOpen, signerEmail]);

  const handleSend = async () => {
    if (!email.trim()) return;

    setStep('sending');
    setError(null);

    try {
      const res = await fetch(`/api/envelopes/${envelopeId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signing_token: signingToken,
          recipient_email: email.trim(),
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send');
      }

      setStep('sent');
      setTimeout(() => {
        onSent();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
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
          className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <FiMail size={16} className="text-zinc-400" />
              <h3 className="font-mono font-black text-sm uppercase tracking-wider text-white">Send Invitation</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-600 hover:text-white transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {step === 'compose' && (
              <div className="space-y-4">
                {/* Recipient info */}
                <div className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <span className="font-mono text-[10px] font-bold text-zinc-400">
                      {signerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold uppercase tracking-wider">{signerName}</div>
                    <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">{signerRole}</div>
                  </div>
                </div>

                {/* Email input */}
                <div>
                  <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-3 bg-black border border-zinc-800 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-white transition-colors"
                    autoFocus
                  />
                </div>

                {/* Message textarea */}
                <div>
                  <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                    Personal Note <span className="text-zinc-700">(Optional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a personal note..."
                    rows={3}
                    className="w-full px-4 py-3 bg-black border border-zinc-800 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-white transition-colors resize-none"
                  />
                </div>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!email.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 font-mono font-black uppercase text-xs tracking-[0.2em] transition-all ${
                    email.trim()
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-zinc-900 text-zinc-700 cursor-not-allowed'
                  }`}
                >
                  <FiSend size={12} />
                  Send Invitation
                </button>
              </div>
            )}

            {step === 'sending' && (
              <div className="text-center py-10">
                <FiLoader className="w-10 h-10 text-zinc-400 animate-spin mx-auto mb-4" />
                <p className="font-mono text-sm font-bold text-white uppercase tracking-wider">Sending...</p>
                <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mt-2">
                  Delivering invitation to {email}
                </p>
              </div>
            )}

            {step === 'sent' && (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-green-950 border border-green-800 flex items-center justify-center mx-auto mb-4">
                  <FiCheck className="w-6 h-6 text-green-400" />
                </div>
                <p className="font-mono text-sm font-bold text-white uppercase tracking-wider">Invitation Sent</p>
                <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mt-2">
                  {signerName} will receive the signing link at {email}
                </p>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-red-950 border border-red-800 flex items-center justify-center mx-auto mb-4">
                  <FiAlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <p className="font-mono text-sm font-bold text-white uppercase tracking-wider">Send Failed</p>
                <p className="font-mono text-[10px] text-red-400 uppercase tracking-widest mt-2">{error}</p>
                <button
                  onClick={() => setStep('compose')}
                  className="mt-6 px-6 py-2.5 border border-zinc-800 text-zinc-400 hover:text-white hover:border-white font-mono text-[10px] uppercase tracking-widest transition-all"
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

export default SendEmailModal;
