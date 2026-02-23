import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * GET /api/bitsign/registered-signature
 * Returns the user's registered signing signature (decrypted SVG).
 * Uses the same server-side decryption pattern as signatures/[id]/preview.
 */
export async function GET(request: NextRequest) {
  try {
    const handle = await resolveUserHandle(request);

    if (!handle) {
      return NextResponse.json({ registered: false }, { status: 200 });
    }

    // Get identity with registered signature info
    const { data: identity } = await supabaseAdmin
      .from('bit_sign_identities')
      .select('registered_signature_id, registered_signature_txid, encryption_key')
      .eq('user_handle', handle)
      .maybeSingle();

    if (!identity?.registered_signature_id) {
      return NextResponse.json({ registered: false });
    }

    // Fetch the signature's encrypted data
    const { data: signature } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, encrypted_payload, iv, signature_type, txid')
      .eq('id', identity.registered_signature_id)
      .eq('user_handle', handle)
      .single();

    if (!signature || !signature.encrypted_payload || !signature.iv) {
      return NextResponse.json({ registered: false });
    }

    if (!identity.encryption_key) {
      return NextResponse.json({ registered: false });
    }

    // Server-side decrypt (same pattern as signatures/[id]/preview)
    const encryptedBytes = Buffer.from(signature.encrypted_payload, 'base64');
    const ivBytes = Buffer.from(signature.iv, 'base64');

    const encoder = new TextEncoder();
    const seedBytes = encoder.encode(identity.encryption_key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', seedBytes);

    const key = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    let decrypted: ArrayBuffer;
    try {
      decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        key,
        encryptedBytes
      );
    } catch {
      return NextResponse.json({ registered: false });
    }

    const decoder = new TextDecoder();
    const svg = decoder.decode(decrypted);

    return NextResponse.json({
      registered: true,
      svg,
      txid: identity.registered_signature_txid,
      id: identity.registered_signature_id,
    });
  } catch (error: any) {
    console.error('[registered-signature] Error:', error);
    return NextResponse.json({ registered: false });
  }
}
