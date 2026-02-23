import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData, hashData } from '@/lib/bsv-inscription';

/**
 * POST /api/envelopes/[id]/sign — Sign an envelope
 * Accepts signing_token + signature_data, records the signature,
 * and auto-inscribes when all required signers have signed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { signing_token, signature_type, signature_data, signer_name, wallet_verification } = body;

    if (!signing_token || !signature_data) {
      return NextResponse.json({
        error: 'Missing required fields: signing_token, signature_data'
      }, { status: 400 });
    }

    // Fetch envelope
    const { data: envelope, error: fetchError } = await supabaseAdmin
      .from('signing_envelopes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }

    // Check envelope status
    if (envelope.status === 'completed') {
      return NextResponse.json({ error: 'Envelope already completed' }, { status: 400 });
    }
    if (envelope.status === 'expired') {
      return NextResponse.json({ error: 'Envelope has expired' }, { status: 400 });
    }
    if (envelope.expires_at && new Date(envelope.expires_at) < new Date()) {
      // Auto-expire
      await supabaseAdmin
        .from('signing_envelopes')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', id);
      return NextResponse.json({ error: 'Envelope has expired' }, { status: 400 });
    }

    // Find signer by token
    const signers = [...envelope.signers];
    const signerIndex = signers.findIndex((s: any) => s.signing_token === signing_token);

    if (signerIndex === -1) {
      return NextResponse.json({ error: 'Invalid signing token' }, { status: 403 });
    }

    const signer = signers[signerIndex];
    if (signer.status === 'signed') {
      return NextResponse.json({ error: 'You have already signed this document' }, { status: 400 });
    }

    // Check signing order (sequential signing)
    const requiredPrior = signers.filter(
      (s: any) => s.order < signer.order && s.status !== 'signed'
    );
    if (requiredPrior.length > 0) {
      return NextResponse.json({
        error: `Waiting for ${requiredPrior[0].name} to sign first`
      }, { status: 400 });
    }

    // Record the signature (drawn + optional wallet verification)
    const signatureRecord: Record<string, any> = {
      type: signature_type || 'drawn',
      data: signature_data,
      signer_name: signer_name || signer.name,
    };

    // Store wallet verification if provided
    if (wallet_verification) {
      signatureRecord.wallet_verified = true;
      signatureRecord.wallet_type = wallet_verification.walletType;
      signatureRecord.wallet_address = wallet_verification.walletAddress;
      signatureRecord.wallet_signature = wallet_verification.signature;
    }

    signers[signerIndex] = {
      ...signer,
      status: 'signed',
      signed_at: new Date().toISOString(),
      signature_data: signatureRecord,
    };

    // Determine new status
    const allSigned = signers.every((s: any) => s.status === 'signed');
    const anySigned = signers.some((s: any) => s.status === 'signed');
    const newStatus = allSigned ? 'completed' : anySigned ? 'partially_signed' : 'pending';

    // If all signed, attempt blockchain inscription
    let inscriptionTxid = null;
    let inscribedAt = null;

    if (allSigned) {
      try {
        // Include wallet-verified signers in inscription
        const walletVerifiedSigners = signers
          .filter((s: any) => s.signature_data?.wallet_verified)
          .map((s: any) => `${s.name}:${s.signature_data.wallet_address}`);

        const result = await inscribeBitSignData({
          type: 'envelope_signing',
          envelopeId: id,
          envelopeTitle: envelope.title,
          documentHash: envelope.document_hash,
          signerName: signers.map((s: any) => s.name).join(', '),
          walletAddress: walletVerifiedSigners.length > 0 ? walletVerifiedSigners.join(', ') : undefined,
          walletType: walletVerifiedSigners.length > 0 ? 'handcash' : undefined,
          signedAt: new Date().toISOString(),
        });

        inscriptionTxid = result.txid;
        inscribedAt = new Date().toISOString();
        console.log(`[envelopes] Inscribed envelope ${id}: ${result.txid}`);
      } catch (inscribeError) {
        console.error('[envelopes] Inscription failed (signature still recorded):', inscribeError);
      }
    }

    // Update envelope
    const { error: updateError } = await supabaseAdmin
      .from('signing_envelopes')
      .update({
        signers,
        status: newStatus,
        inscription_txid: inscriptionTxid || envelope.inscription_txid,
        inscribed_at: inscribedAt || envelope.inscribed_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[envelopes] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to record signature' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      signer: signer.name,
      role: signer.role,
      status: newStatus,
      all_signed: allSigned,
      wallet_verified: !!wallet_verification,
      wallet_type: wallet_verification?.walletType || null,
      inscription_txid: inscriptionTxid,
      explorer_url: inscriptionTxid ? `https://whatsonchain.com/tx/${inscriptionTxid}` : null,
    });
  } catch (error: any) {
    console.error('[envelopes] Sign error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
