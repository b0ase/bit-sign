import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const VERIFF_API_KEY = process.env.VERIFF_API_KEY || '';
const VERIFF_API_URL = 'https://stationapi.veriff.com/v1/sessions';

/**
 * POST /api/bitsign/kyc/veriff/start
 * Create a Veriff verification session and return the redirect URL.
 * User completes ID verification on Veriff's hosted UI.
 * Decision arrives via webhook at /api/webhooks/veriff.
 */
export async function POST(request: NextRequest) {
  try {
    const handle = await resolveUserHandle(request);
    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!VERIFF_API_KEY) {
      return NextResponse.json({ error: 'Veriff not configured' }, { status: 500 });
    }

    // Look up identity
    const { data: identity } = await supabaseAdmin
      .from('bit_sign_identities')
      .select('id, token_id')
      .eq('user_handle', handle)
      .maybeSingle();

    if (!identity) {
      return NextResponse.json({ error: 'No identity token found. Mint your identity first.' }, { status: 400 });
    }

    // Check for existing KYC strand
    const { data: existingStrand } = await supabaseAdmin
      .from('bit_sign_strands')
      .select('id')
      .eq('identity_id', identity.id)
      .eq('strand_type', 'kyc')
      .eq('strand_subtype', 'veriff')
      .maybeSingle();

    if (existingStrand) {
      return NextResponse.json({ error: 'KYC verification already completed' }, { status: 400 });
    }

    // Check for pending session
    const { data: pendingSession } = await supabaseAdmin
      .from('bit_sign_kyc_sessions')
      .select('id, veriff_url, status')
      .eq('user_handle', handle)
      .eq('status', 'created')
      .maybeSingle();

    if (pendingSession?.veriff_url) {
      return NextResponse.json({ url: pendingSession.veriff_url });
    }

    // Create Veriff session
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://bit-sign.online';
    const res = await fetch(VERIFF_API_URL, {
      method: 'POST',
      headers: {
        'X-AUTH-CLIENT': VERIFF_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        verification: {
          callback: `${origin}/api/webhooks/veriff`,
          person: {
            firstName: '',
            lastName: '',
          },
          vendorData: handle,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[veriff] Session creation failed:', res.status, errText);
      return NextResponse.json({ error: 'Failed to create verification session' }, { status: 502 });
    }

    const data = await res.json();
    const { id: sessionId, url: sessionUrl, status } = data.verification;

    console.log(`[veriff] Session created for ${handle}: ${sessionId} (${status})`);

    // Store session
    await supabaseAdmin
      .from('bit_sign_kyc_sessions')
      .insert({
        user_handle: handle,
        veriff_session_id: sessionId,
        veriff_url: sessionUrl,
        status: status || 'created',
      });

    return NextResponse.json({ url: sessionUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to start KYC verification';
    console.error('[veriff] Start error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
