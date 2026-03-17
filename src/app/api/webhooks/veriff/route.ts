import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

const VERIFF_WEBHOOK_SECRET = process.env.VERIFF_WEBHOOK_SECRET || '';

/**
 * POST /api/webhooks/veriff
 * Receives decision webhooks from Veriff after ID verification.
 * Verifies HMAC-SHA256 signature, creates kyc/veriff strand on approval.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify HMAC signature
    if (VERIFF_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-hmac-signature') || '';
      const expected = createHmac('sha256', VERIFF_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature.toLowerCase() !== expected.toLowerCase()) {
        console.error('[veriff-webhook] HMAC mismatch');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const verification = payload.verification;

    if (!verification?.id || !verification?.status) {
      console.warn('[veriff-webhook] Missing verification data');
      return NextResponse.json({ ok: true });
    }

    const sessionId = verification.id;
    const status = verification.status;

    console.log(`[veriff-webhook] Decision: session=${sessionId} status=${status}`);

    // Look up our session record
    const { data: session } = await supabaseAdmin
      .from('bit_sign_kyc_sessions')
      .select('id, user_handle, status')
      .eq('veriff_session_id', sessionId)
      .maybeSingle();

    if (!session) {
      console.warn(`[veriff-webhook] Unknown session: ${sessionId}`);
      return NextResponse.json({ ok: true });
    }

    // Already processed
    if (session.status === 'approved') {
      return NextResponse.json({ ok: true });
    }

    // Store decision payload (scrub sensitive data)
    const safePayload = {
      status,
      person: verification.person ? {
        firstName: verification.person.firstName,
        lastName: verification.person.lastName,
        dateOfBirth: verification.person.dateOfBirth,
      } : null,
      document: verification.document ? {
        type: verification.document.type,
        country: verification.document.country,
        // Only last 4 chars of document number for audit trail
        numberSuffix: verification.document.number
          ? verification.document.number.slice(-4)
          : null,
      } : null,
      vendorData: verification.vendorData,
      decisionTime: new Date().toISOString(),
    };

    // Update session
    await supabaseAdmin
      .from('bit_sign_kyc_sessions')
      .update({
        status,
        decision_payload: safePayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (status === 'approved') {
      // Create the kyc/veriff strand
      const handle = session.user_handle;

      const { data: identity } = await supabaseAdmin
        .from('bit_sign_identities')
        .select('id, token_id')
        .eq('user_handle', handle)
        .maybeSingle();

      if (identity) {
        await createStrand({
          identityId: identity.id,
          rootTxid: identity.token_id,
          strandType: 'kyc',
          strandSubtype: 'veriff',
          providerId: sessionId,
          label: 'Veriff KYC — Identity Verified',
          userHandle: handle,
          metadata: {
            firstName: safePayload.person?.firstName,
            lastName: safePayload.person?.lastName,
            dateOfBirth: safePayload.person?.dateOfBirth,
            documentType: safePayload.document?.type,
            documentCountry: safePayload.document?.country,
            verifiedAt: safePayload.decisionTime,
          },
        });

        console.log(`[veriff-webhook] KYC strand created for ${handle} — Level 4 Sovereign`);
      } else {
        console.error(`[veriff-webhook] No identity found for handle: ${handle}`);
      }
    } else {
      console.log(`[veriff-webhook] Non-approval for ${session.user_handle}: ${status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[veriff-webhook] Error:', msg);
    // Always return 200 to prevent Veriff retries on our errors
    return NextResponse.json({ ok: true });
  }
}
