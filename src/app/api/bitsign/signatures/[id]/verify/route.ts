import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyBitSignInscription } from '@/lib/bsv-inscription';

/**
 * GET /api/bitsign/signatures/[id]/verify — Public verification endpoint
 * Returns the full provenance chain for a sealed document:
 *   preInscriptionHash → sealTxid → finalHash → confirmationTxid
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: sig, error } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, user_handle, signature_type, payload_hash, txid, metadata, created_at, wallet_address, wallet_signed')
      .eq('id', id)
      .single();

    if (error || !sig) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    const meta = (sig.metadata || {}) as Record<string, any>;

    // Build provenance chain
    const provenance = {
      preInscriptionHash: meta.preInscriptionHash || null,
      sealTxid: sig.txid || null,
      finalHash: sig.payload_hash || null,
      confirmationTxid: meta.confirmationTxid || null,
    };

    // Verify seal inscription on-chain
    let sealVerification = null;
    if (provenance.sealTxid && !provenance.sealTxid.startsWith('pending-')) {
      try {
        const result = await verifyBitSignInscription(provenance.sealTxid);
        sealVerification = {
          found: result.found,
          dataHash: result.dataHash || null,
          onChainDocumentHash: result.data?.documentHash || null,
          matchesPreInscription: result.data?.documentHash === provenance.preInscriptionHash,
        };
      } catch {
        sealVerification = { found: false, error: 'Could not verify seal transaction' };
      }
    }

    // Verify confirmation inscription on-chain
    let confirmationVerification = null;
    if (provenance.confirmationTxid && !provenance.confirmationTxid.startsWith('pending-')) {
      try {
        const result = await verifyBitSignInscription(provenance.confirmationTxid);
        confirmationVerification = {
          found: result.found,
          dataHash: result.dataHash || null,
          onChainFinalHash: result.data?.finalHash || null,
          onChainSealTxid: result.data?.sealTxid || null,
          matchesFinalHash: result.data?.finalHash === provenance.finalHash,
          matchesSealTxid: result.data?.sealTxid === provenance.sealTxid,
        };
      } catch {
        confirmationVerification = { found: false, error: 'Could not verify confirmation transaction' };
      }
    }

    // Overall verification status
    const sealOk = sealVerification?.found && sealVerification?.matchesPreInscription;
    const confirmOk = confirmationVerification?.found && confirmationVerification?.matchesFinalHash && confirmationVerification?.matchesSealTxid;
    const hasConfirmation = !!provenance.confirmationTxid;

    let verificationStatus: 'full' | 'partial' | 'seal_only' | 'unverified';
    if (sealOk && confirmOk) {
      verificationStatus = 'full';
    } else if (sealOk && !hasConfirmation) {
      verificationStatus = 'seal_only';
    } else if (sealOk) {
      verificationStatus = 'partial';
    } else {
      verificationStatus = 'unverified';
    }

    return NextResponse.json({
      signature: {
        id: sig.id,
        signatureType: sig.signature_type,
        signerHandle: sig.user_handle,
        walletAddress: sig.wallet_address || meta.walletAddress || null,
        walletSigned: sig.wallet_signed,
        originalFileName: meta.originalFileName || null,
        sealedAt: sig.created_at,
      },
      provenance,
      verification: {
        status: verificationStatus,
        seal: sealVerification,
        confirmation: confirmationVerification,
      },
      explorerUrls: {
        seal: provenance.sealTxid ? `https://whatsonchain.com/tx/${provenance.sealTxid}` : null,
        confirmation: provenance.confirmationTxid ? `https://whatsonchain.com/tx/${provenance.confirmationTxid}` : null,
      },
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (error: any) {
    console.error('[signatures] Verify error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
