import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/register-signature
 * Registers a TLDRAW signature as the user's default signing signature.
 * Requires the signature to exist, belong to the user, be type TLDRAW, and have a real txid.
 */
export async function POST(request: NextRequest) {
  try {
    const handle = await resolveUserHandle(request);

    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signature_id } = await request.json();

    if (!signature_id) {
      return NextResponse.json({ error: 'Missing signature_id' }, { status: 400 });
    }

    // Verify the signature exists, belongs to user, is TLDRAW, and has a txid
    const { data: signature, error: sigError } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, user_handle, signature_type, txid')
      .eq('id', signature_id)
      .eq('user_handle', handle)
      .single();

    if (sigError || !signature) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    if (signature.signature_type !== 'TLDRAW') {
      return NextResponse.json({ error: 'Only hand-drawn signatures can be registered' }, { status: 400 });
    }

    if (!signature.txid || signature.txid.startsWith('pending-')) {
      return NextResponse.json({ error: 'Signature must be inscribed on-chain first' }, { status: 400 });
    }

    // Update identity with registered signature
    const { error: updateError } = await supabaseAdmin
      .from('bit_sign_identities')
      .update({
        registered_signature_id: signature.id,
        registered_signature_txid: signature.txid,
      })
      .eq('user_handle', handle);

    if (updateError) {
      console.error('[register-signature] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to register signature' }, { status: 500 });
    }

    // Create registered_signature strand
    try {
      const { data: identity } = await supabaseAdmin
        .from('bit_sign_identities')
        .select('id, token_id')
        .eq('user_handle', handle)
        .maybeSingle();

      if (identity) {
        await createStrand({
          identityId: identity.id,
          rootTxid: identity.token_id,
          strandType: 'registered_signature',
          signatureId: signature.id,
          label: 'Registered Signature',
          metadata: { txid: signature.txid },
          userHandle: handle,
        });
      }
    } catch (strandErr) {
      console.warn('[register-signature] Strand creation failed (non-fatal):', strandErr);
    }

    return NextResponse.json({
      success: true,
      registered_signature_id: signature.id,
      registered_signature_txid: signature.txid,
    });
  } catch (error: any) {
    console.error('[register-signature] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
