import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyBitSignInscription } from '@/lib/bsv-inscription';

/**
 * GET /api/envelopes/[id]/verify — Public verification endpoint
 * Shows signers, timestamps, and blockchain proof
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: envelope, error } = await supabaseAdmin
      .from('signing_envelopes')
      .select('id, title, document_type, status, document_hash, signers, inscription_txid, inscribed_at, created_at, created_by_handle')
      .eq('id', id)
      .single();

    if (error || !envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }

    // Strip signing tokens from public response, include per-signer inscription txids
    const publicSigners = (envelope.signers as any[]).map((s) => ({
      name: s.name,
      role: s.role,
      status: s.status,
      signed_at: s.signed_at,
      inscription_txid: s.signature_data?.inscription_txid || null,
    }));

    // Verify blockchain inscription if present
    // If inscribed_at is set, the inscription was already verified — skip the WhatsOnChain call
    let blockchainVerification = null;
    if (envelope.inscription_txid && !envelope.inscription_txid.startsWith('pending-')) {
      if (envelope.inscribed_at) {
        // Already verified — return cached result instantly
        blockchainVerification = {
          verified: true,
          txid: envelope.inscription_txid,
          explorer_url: `https://whatsonchain.com/tx/${envelope.inscription_txid}`,
          inscribed_at: envelope.inscribed_at,
        };
      } else {
        // First-time verification — fetch from blockchain
        try {
          const verification = await verifyBitSignInscription(envelope.inscription_txid);
          blockchainVerification = {
            verified: verification.found,
            txid: envelope.inscription_txid,
            explorer_url: `https://whatsonchain.com/tx/${envelope.inscription_txid}`,
            data_hash: verification.dataHash,
            inscribed_at: envelope.inscribed_at,
          };
          // Cache the verification by setting inscribed_at
          if (verification.found && !envelope.inscribed_at) {
            await supabaseAdmin
              .from('signing_envelopes')
              .update({ inscribed_at: new Date().toISOString() })
              .eq('id', id);
          }
        } catch {
          blockchainVerification = {
            verified: false,
            txid: envelope.inscription_txid,
            explorer_url: `https://whatsonchain.com/tx/${envelope.inscription_txid}`,
            error: 'Could not verify on-chain data',
          };
        }
      }
    }

    return NextResponse.json({
      envelope: {
        id: envelope.id,
        title: envelope.title,
        document_type: envelope.document_type,
        status: envelope.status,
        document_hash: envelope.document_hash,
        created_by: envelope.created_by_handle,
        created_at: envelope.created_at,
      },
      signers: publicSigners,
      blockchain: blockchainVerification,
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (error: any) {
    console.error('[envelopes] Verify error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
