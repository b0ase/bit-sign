import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/signatures/[id]/attest
 * Records a wallet attestation (HandCash signature) on an existing signature item.
 * This marks the item as "Signed" with wallet proof.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const handle = await resolveUserHandle(request);

    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { wallet_signature, wallet_address, payment_txid } = await request.json();

    if (!wallet_signature || !wallet_address) {
      return NextResponse.json({ error: 'Missing wallet_signature or wallet_address' }, { status: 400 });
    }

    // Verify signature belongs to user
    const { data: signature, error: sigError } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, user_handle, signature_type, metadata')
      .eq('id', id)
      .eq('user_handle', handle)
      .single();

    if (sigError || !signature) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    // Update with wallet attestation
    const { error: updateError } = await supabaseAdmin
      .from('bit_sign_signatures')
      .update({
        wallet_signed: true,
        wallet_signature,
        wallet_address,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[attest] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to record attestation' }, { status: 500 });
    }

    // Retroactively create strand for pre-upgrade items
    try {
      const { data: identity } = await supabaseAdmin
        .from('bit_sign_identities')
        .select('id, token_id')
        .eq('user_handle', handle)
        .maybeSingle();

      if (identity) {
        // Check if strand already exists for this signature
        const { data: existingStrand } = await supabaseAdmin
          .from('bit_sign_strands')
          .select('id')
          .eq('identity_id', identity.id)
          .eq('signature_id', id)
          .maybeSingle();

        if (!existingStrand) {
          await createStrand({
            identityId: identity.id,
            rootTxid: identity.token_id,
            strandType: 'vault_item',
            strandSubtype: signature.signature_type,
            signatureId: id,
            label: signature.metadata?.type || signature.signature_type,
            userHandle: handle,
          });
        }
      }
    } catch (strandErr) {
      console.warn('[attest] Retroactive strand creation failed (non-fatal):', strandErr);
    }

    return NextResponse.json({
      success: true,
      wallet_signed: true,
      payment_txid: payment_txid || null,
    });
  } catch (error: any) {
    console.error('[attest] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
