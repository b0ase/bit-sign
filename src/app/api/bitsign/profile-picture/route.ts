import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/profile-picture
 * Sets a vault CAMERA photo as the user's profile picture (avatar).
 */
export async function POST(request: NextRequest) {
  try {
    const handle = await resolveUserHandle(request);
    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signatureId } = await request.json();

    if (!signatureId) {
      return NextResponse.json({ error: 'Missing signatureId' }, { status: 400 });
    }

    // Verify vault item belongs to user and is a CAMERA type
    const { data: sig } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, signature_type, wallet_signed')
      .eq('id', signatureId)
      .eq('user_handle', handle)
      .eq('signature_type', 'CAMERA')
      .single();

    if (!sig) {
      return NextResponse.json({ error: 'Photo not found or not a camera capture' }, { status: 404 });
    }

    // Only attested photos can be used as profile pictures
    if (!sig.wallet_signed) {
      return NextResponse.json({ error: 'Only attested photos can be used as profile pictures. Attest this photo first.' }, { status: 400 });
    }

    // Construct avatar URL pointing to the preview API
    const avatarUrl = `/api/bitsign/signatures/${signatureId}/preview`;

    // Update avatar on identity record
    const { error: updateError } = await supabaseAdmin
      .from('bit_sign_identities')
      .update({ avatar_url: avatarUrl })
      .eq('user_handle', handle);

    if (updateError) throw updateError;

    // Create profile_photo strand
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
          strandType: 'profile_photo',
          signatureId: signatureId,
          label: 'Profile Photo',
          userHandle: handle,
        });
      }
    } catch (strandErr) {
      console.warn('[profile-picture] Strand creation failed (non-fatal):', strandErr);
    }

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error: any) {
    console.error('[profile-picture] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to set profile picture' }, { status: 500 });
  }
}
