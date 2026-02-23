import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/envelopes/resolve?token=... — Resolve a signing token to envelope + signer info
 * Used by the public /sign/[token] page
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    // Search for envelope containing this signing token
    const { data: envelopes, error } = await supabaseAdmin
      .from('signing_envelopes')
      .select('*')
      .not('status', 'eq', 'expired');

    if (error) {
      console.error('[resolve] Query error:', error);
      return NextResponse.json({ error: 'Failed to resolve token' }, { status: 500 });
    }

    // Find the envelope and signer matching this token
    for (const envelope of envelopes || []) {
      const signers = envelope.signers as any[];
      const signer = signers.find((s) => s.signing_token === token);
      if (signer) {
        return NextResponse.json({
          envelope: {
            id: envelope.id,
            title: envelope.title,
            document_type: envelope.document_type,
            status: envelope.status,
            document_html: envelope.document_html,
            document_hash: envelope.document_hash,
            created_by: envelope.created_by_handle,
            created_at: envelope.created_at,
            expires_at: envelope.expires_at,
          },
          signer: {
            name: signer.name,
            role: signer.role,
            order: signer.order,
            status: signer.status,
            signed_at: signer.signed_at,
          },
          all_signers: signers.map((s: any) => ({
            name: s.name,
            role: s.role,
            status: s.status,
            signed_at: s.signed_at,
          })),
        });
      }
    }

    return NextResponse.json({ error: 'Invalid or expired signing token' }, { status: 404 });
  } catch (error: any) {
    console.error('[resolve] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
