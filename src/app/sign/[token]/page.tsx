'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SovereignSignature from '@/components/SovereignSignature';
import { WalletSigningModal } from '@/components/bitsign/WalletSigningModal';
import { generateSigningMessage } from './signing-message';
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

  // Two-step signing: draw first, then wallet verify (pays $0.01)
  const [drawnSignature, setDrawnSignature] = useState<{ svg: string; json: string } | null>(null);
  const [showWalletVerify, setShowWalletVerify] = useState(false);
  const [walletVerification, setWalletVerification] = useState<{
    walletType: string;
    walletAddress: string;
    signature: string;
    publicKey?: string;
    paymentTxid?: string;
  } | null>(null);

  // Registered signature (pre-existing on-chain signature the user can reuse)
  const [registeredSig, setRegisteredSig] = useState<{
    svg: string;
    txid: string;
    id: string;
  } | null>(null);
  const [useRegistered, setUseRegistered] = useState(false);

  useEffect(() => {
    if (token) resolveToken();
    fetchRegisteredSignature();
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

  const fetchRegisteredSignature = async () => {
    try {
      const res = await fetch('/api/bitsign/registered-signature');
      const data = await res.json();
      if (data.registered) {
        setRegisteredSig({ svg: data.svg, txid: data.txid, id: data.id });
      }
    } catch {
      // No registered signature — that's fine
    }
  };

  // Sign with the pre-registered signature (skips drawing canvas)
  const handleSignWithRegistered = () => {
    if (!registeredSig) return;
    setUseRegistered(true);
    setDrawnSignature({ svg: registeredSig.svg, json: '' });
    setShowWalletVerify(true);
  };

  // Step 1: Capture drawn signature
  const handleDrawnSignature = (signatureData: { svg: string; json: string }) => {
    setDrawnSignature(signatureData);
    setShowSignature(false);
    // Show wallet verification step
    setShowWalletVerify(true);
  };

  // Step 2: Wallet verification complete (includes $0.01 payment)
  const handleWalletVerify = (result: {
    walletType: string;
    walletAddress: string;
    signature: string;
    message: string;
    paymentTxid?: string;
  }) => {
    setWalletVerification({
      walletType: result.walletType,
      walletAddress: result.walletAddress,
      signature: result.signature,
      paymentTxid: result.paymentTxid,
    });
    setShowWalletVerify(false);
    // Submit with both signatures + payment proof
    submitSignature(drawnSignature!, {
      walletType: result.walletType,
      walletAddress: result.walletAddress,
      signature: result.signature,
    }, result.paymentTxid);
  };

  // Skip wallet verification and submit with drawn signature only
  const handleSkipWallet = () => {
    setShowWalletVerify(false);
  };

  // Submit without wallet (fallback)
  const handleSubmitWithoutWallet = () => {
    submitSignature(drawnSignature!, null);
  };

  // Submit the full signature (drawn + wallet + payment)
  const submitSignature = async (
    drawn: { svg: string; json: string },
    wallet: { walletType: string; walletAddress: string; signature: string } | null,
    paymentTxid?: string,
  ) => {
    if (!envelope) return;
    setSigning(true);

    try {
      const res = await fetch(`/api/envelopes/${envelope.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signing_token: token,
          signature_type: wallet ? 'drawn+wallet' : 'drawn',
          signature_data: drawn.svg,
          signer_name: signer?.name,
          wallet_verification: wallet || undefined,
          payment_txid: paymentTxid || undefined,
          registered_signature_txid: useRegistered ? registeredSig?.txid : undefined,
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

  // Generate the signing message for wallet verification
  const signingMessage = envelope && signer
    ? generateSigningMessage({
        documentTitle: envelope.title,
        documentHash: envelope.document_hash,
        signerName: signer.name,
      })
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white animate-spin rounded-full opacity-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <FiAlertCircle className="text-red-500 text-4xl mb-6" />
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Error</h1>
        <p className="text-zinc-400 text-sm">{error}</p>
      </div>
    );
  }

  if (signResult) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-lg space-y-6">
          <FiCheck className="mx-auto text-green-400" size={48} />
          <h1 className="text-3xl font-bold tracking-tight">Signed</h1>
          <p className="text-zinc-400 text-sm">
            Your signature has been recorded for this document.
          </p>

          {signResult.wallet_verified && (
            <div className="p-4 border border-green-900 bg-green-950/20 rounded-md space-y-2">
              <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                <FiShield size={14} /> Wallet verified via {signResult.wallet_type}
              </p>
              {signResult.fee_paid && (
                <p className="text-xs text-zinc-500">Attestation fee paid ($0.01)</p>
              )}
            </div>
          )}

          {signResult.all_signed && (
            <div className="p-6 border border-green-900 bg-green-950/20 space-y-3 rounded-md">
              <FiShield className="mx-auto text-green-400" size={24} />
              <p className="text-sm text-green-400 font-medium">All parties have signed</p>
              {signResult.inscription_txid && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Blockchain Proof</p>
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
            <p className="text-sm text-zinc-500">
              Waiting for other signers to complete.
            </p>
          )}

          <Link
            href={`/verify/${envelope?.id}`}
            className="inline-block px-6 py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-all"
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
            <FiFileText className="text-zinc-500" size={18} />
            <p className="text-sm text-zinc-500">
              Signing Request
            </p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{envelope?.title}</h1>
          <div className="flex gap-6 text-sm text-zinc-500">
            <span>From: {envelope?.created_by}</span>
            <span className="font-mono text-xs">Hash: {envelope?.document_hash.slice(0, 16)}...</span>
          </div>
        </header>

        {/* Signer Info */}
        <div className="p-4 border border-zinc-800 bg-zinc-950 rounded-md flex items-center justify-between">
          <div>
            <span className="block text-sm font-medium text-white">{signer?.name}</span>
            <span className="block text-xs text-zinc-500">{signer?.role}</span>
          </div>
          {signer?.status === 'signed' ? (
            <span className="px-3 py-1.5 text-green-400 bg-green-950 text-xs rounded flex items-center gap-2">
              <FiCheck size={12} /> Already Signed
            </span>
          ) : (
            <span className="px-3 py-1.5 text-amber-400 bg-amber-950 text-xs rounded flex items-center gap-2">
              <FiClock size={12} /> Awaiting Signature
            </span>
          )}
        </div>

        {/* Signers Progress */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {allSigners.map((s, i) => (
            <div
              key={i}
              className={`p-3 border rounded-md text-center ${
                s.status === 'signed'
                  ? 'border-green-900 bg-green-950/10'
                  : 'border-zinc-900 bg-zinc-950'
              }`}
            >
              <span className="block text-xs text-zinc-500">{s.role}</span>
              <span className="block text-sm font-medium mt-1">{s.name || 'Pending'}</span>
              {s.status === 'signed' && <FiCheck className="mx-auto mt-1 text-green-400" size={12} />}
            </div>
          ))}
        </div>

        {/* Document Preview */}
        {envelope?.document_html && (
          envelope.document_type === 'uploaded_document' && envelope.document_html.startsWith('data:') ? (
            <div className="border border-zinc-800 rounded-md overflow-hidden">
              {envelope.document_html.startsWith('data:application/pdf') ? (
                <iframe src={envelope.document_html} className="w-full h-[600px]" />
              ) : envelope.document_html.startsWith('data:image/') ? (
                <img src={envelope.document_html} alt="Document" className="w-full max-h-[600px] object-contain bg-white" />
              ) : (
                <div className="p-8 text-center">
                  <FiFileText className="mx-auto text-zinc-500 mb-3" size={32} />
                  <a href={envelope.document_html} download className="text-sm text-white underline">Download Document</a>
                </div>
              )}
            </div>
          ) : envelope.document_html ? (
            <div className="border border-zinc-800 rounded-md overflow-hidden">
              <div className="bg-white text-black p-8 overflow-y-auto max-h-[600px]">
                <div dangerouslySetInnerHTML={{ __html: envelope.document_html }} />
              </div>
            </div>
          ) : null
        )}

        {/* Drawn Signature Preview (if captured, before submission) */}
        {drawnSignature && !signing && !signResult && (
          <div className="p-4 border border-zinc-800 bg-zinc-950 space-y-3 rounded-md">
            <p className="text-xs text-zinc-500">Your Drawn Signature</p>
            <div className="bg-white p-4 rounded flex items-center justify-center max-h-32">
              <div dangerouslySetInnerHTML={{ __html: drawnSignature.svg }} className="max-h-24 [&>svg]:max-h-24 [&>svg]:w-auto" />
            </div>
            <div className="flex items-center gap-2">
              <FiCheck className="text-green-400" size={12} />
              <span className="text-xs text-green-400">Captured</span>
            </div>
          </div>
        )}

        {/* Sign Button — with registered signature option */}
        {signer?.status !== 'signed' && !drawnSignature && (
          <div className="pt-4 space-y-4">
            {registeredSig && (
              <div className="p-4 border border-zinc-800 bg-zinc-950 rounded-md space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-400">Your Registered Signature</p>
                  <span className="px-2 py-1 bg-green-950/30 text-green-400 text-xs rounded flex items-center gap-1">
                    <FiShield size={10} /> On chain
                  </span>
                </div>
                <div className="bg-white p-3 rounded flex items-center justify-center max-h-24">
                  <div dangerouslySetInnerHTML={{ __html: registeredSig.svg }} className="max-h-20 [&>svg]:max-h-20 [&>svg]:w-auto" />
                </div>
                <button
                  onClick={handleSignWithRegistered}
                  className="w-full py-3.5 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <FiShield /> Sign with Your Registered Signature ($0.01)
                </button>
              </div>
            )}
            <button
              onClick={() => setShowSignature(true)}
              className={`w-full py-3.5 font-medium text-sm rounded-md transition-all flex items-center justify-center gap-2 ${
                registeredSig
                  ? 'border border-zinc-800 bg-black text-zinc-400 hover:text-white hover:border-zinc-600'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              <FiEdit3 /> {registeredSig ? 'Draw a different signature' : 'Sign Document'}
            </button>
            <p className="text-center text-sm text-zinc-500">
              By signing, you confirm you have reviewed and agree to this document.
            </p>
          </div>
        )}

        {/* Signature Modal */}
        {showSignature && (
          <SovereignSignature
            onSave={handleDrawnSignature}
            onCancel={() => setShowSignature(false)}
          />
        )}

        {/* Wallet Verification Modal */}
        <WalletSigningModal
          isOpen={showWalletVerify}
          onClose={handleSkipWallet}
          onSignComplete={handleWalletVerify}
          message={signingMessage}
          title="Verify & Pay"
          envelopeId={envelope?.id}
        />

        {/* Post-signature buttons (shown after drawing, before submission) */}
        {drawnSignature && !showWalletVerify && !signing && !signResult && !walletVerification && (
          <div className="pt-4 space-y-3">
            <button
              onClick={() => setShowWalletVerify(true)}
              className="w-full py-3.5 bg-white text-black font-medium text-sm rounded-md hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <FiShield /> Verify with HandCash & Sign ($0.01)
            </button>
            <p className="text-center text-xs text-zinc-500">
              Your identity will be verified and your signature recorded on the Bitcoin blockchain.
            </p>
            <button
              onClick={handleSubmitWithoutWallet}
              className="w-full py-2.5 text-zinc-600 text-xs hover:text-zinc-400 transition-all"
            >
              Skip verification (signature won't be recorded on blockchain)
            </button>
          </div>
        )}

        {/* Processing Overlay */}
        {signing && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-t-2 border-white animate-spin rounded-full opacity-30" />
              <div className="text-center space-y-1">
                <span className="block text-base text-white font-medium">Signing...</span>
                <span className="block text-sm text-zinc-500">Recording signature on blockchain</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
