import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSigningInvitation } from '@/lib/email';

/**
 * POST /api/envelopes/[id]/send — Email a signing invitation to a signer
 * Body: { signing_token, recipient_email, message? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const handle = request.cookies.get('handcash_handle')?.value;
    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { signing_token, recipient_email, message } = await request.json();

    if (!signing_token || !recipient_email) {
      return NextResponse.json(
        { error: 'Missing required fields: signing_token, recipient_email' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient_email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Fetch envelope and verify ownership
    const { data: envelope, error: fetchError } = await supabaseAdmin
      .from('signing_envelopes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }

    if (envelope.created_by_handle !== handle) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the signer by token
    const signers = envelope.signers as any[];
    const signerIndex = signers.findIndex((s: any) => s.signing_token === signing_token);

    if (signerIndex === -1) {
      return NextResponse.json({ error: 'Signer not found' }, { status: 404 });
    }

    const signer = signers[signerIndex];

    // Rate limit: block re-send within 5 minutes
    if (signer.email_sent_at) {
      const lastSent = new Date(signer.email_sent_at).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      if (Date.now() - lastSent < fiveMinutes) {
        const waitSeconds = Math.ceil((fiveMinutes - (Date.now() - lastSent)) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSeconds}s before resending` },
          { status: 429 }
        );
      }
    }

    // Build signing URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online';
    const signingUrl = `${baseUrl}/sign/${signing_token}`;

    // Send the email
    const result = await sendSigningInvitation({
      recipientEmail: recipient_email,
      recipientName: signer.name,
      signerRole: signer.role,
      senderHandle: handle,
      documentTitle: envelope.title,
      signingUrl,
      message,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    // Update signer JSONB with email metadata
    const updatedSigners = [...signers];
    updatedSigners[signerIndex] = {
      ...signer,
      email: recipient_email,
      email_sent_at: new Date().toISOString(),
      email_sent_to: recipient_email,
    };

    const { error: updateError } = await supabaseAdmin
      .from('signing_envelopes')
      .update({ signers: updatedSigners })
      .eq('id', id);

    if (updateError) {
      console.error('[send] Failed to update signer metadata:', updateError);
      // Email was sent successfully, so we still return success
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[send] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
