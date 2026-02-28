import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { hashData } from '@/lib/bsv-inscription';
import { getUserAccount } from '@/lib/handcash';
import { createStrand } from '@/lib/identity-strands';
import sharp from 'sharp';

// Allow large payloads for multi-page document composites
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/bitsign/seal
 * Stores a sealed (signature-placed) document composite and inscribes it on-chain.
 */
export async function POST(request: NextRequest) {
  try {
    const handle = await resolveUserHandle(request);
    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      originalDocumentId,
      compositeData,
      placement,
      elements,
      walletSignature,
      walletAddress,
      paymentTxid,
    } = await request.json();

    if (!originalDocumentId || !compositeData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify original document belongs to user or they have an access grant
    const { data: originalDoc } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, signature_type, metadata, user_handle')
      .eq('id', originalDocumentId)
      .single();

    if (!originalDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (originalDoc.user_handle !== handle) {
      // Check for access grant (shared / co-sign)
      const { data: grantRows } = await supabaseAdmin
        .from('document_access_grants')
        .select('id')
        .eq('document_id', originalDocumentId)
        .eq('grantee_handle', handle)
        .is('revoked_at', null)
        .limit(1);

      if (!grantRows?.length) {
        return NextResponse.json({ error: 'Document not found or not yours' }, { status: 404 });
      }
    }

    // Resolve the real document name — walk up the seal chain if needed
    let originalFileName = originalDoc.metadata?.fileName || originalDoc.metadata?.originalFileName || null;
    if (!originalFileName || originalFileName === 'Sealed Document') {
      // This doc is itself a sealed doc — look up its original
      let walkDocId = originalDoc.metadata?.originalDocumentId;
      let depth = 0;
      while (walkDocId && depth < 5) {
        const { data: parentDoc } = await supabaseAdmin
          .from('bit_sign_signatures')
          .select('metadata')
          .eq('id', walkDocId)
          .maybeSingle();
        if (!parentDoc) break;
        const name = parentDoc.metadata?.fileName || parentDoc.metadata?.originalFileName;
        if (name && name !== 'Sealed Document') {
          originalFileName = name;
          break;
        }
        walkDocId = parentDoc.metadata?.originalDocumentId;
        depth++;
      }
    }
    if (!originalFileName || originalFileName === 'Sealed Document') {
      originalFileName = 'Document';
    }

    // Hash the composite image data
    const compositeHash = await hashData(compositeData);

    // Inscribe on-chain via user's HandCash wallet
    let txid: string;
    let inscriptionResult: { transactionId: string } | null = null;

    const authToken = request.cookies.get('handcash_auth_token')?.value;
    const userAccount = authToken ? getUserAccount(authToken) : null;

    if (userAccount) {
      try {
        const inscriptionData = {
          protocol: 'b0ase-bitsign',
          version: '1.0',
          type: 'document_signature',
          documentHash: compositeHash,
          signerName: handle,
          walletType: 'handcash',
          signedAt: new Date().toISOString(),
        };

        const paymentResult = await userAccount.wallet.pay({
          description: `BitSign: Seal document "${originalFileName}"`,
          appAction: 'seal',
          payments: [
            { destination: handle, currencyCode: 'BSV', sendAmount: 0.00001 },
          ],
          attachment: { format: 'json', value: inscriptionData },
        });

        txid = paymentResult.transactionId;
        inscriptionResult = paymentResult;
        console.log(`[seal] On-chain inscription via HandCash: ${txid}`);
      } catch (inscribeError: any) {
        console.warn('[seal] HandCash inscription failed:', inscribeError?.message || inscribeError);
        txid = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      }
    } else {
      console.warn('[seal] No HandCash auth token — cannot inscribe on-chain');
      txid = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // Burn the real TXID onto the seal stamp in the border area.
    // The client leaves a blank line (2nd from bottom) for the TXID.
    // We write green TXID text there, or skip if inscription failed.
    let finalBase64 = compositeData.replace(/^data:image\/\w+;base64,/, '');
    const isJpeg = compositeData.startsWith('data:image/jpeg');

    try {
      const imgBuffer = Buffer.from(finalBase64, 'base64');
      const imgMeta = await sharp(imgBuffer).metadata();
      const imgW = imgMeta.width || 800;
      const imgH = imgMeta.height || 600;

      // Match client layout constants exactly
      const stampFontSize = Math.max(14, Math.round(imgW * 0.016));
      const lineHeight = Math.round(stampFontSize * 1.5);
      const borderWidth = Math.round(imgW * 0.04);
      const stampTextX = borderWidth + Math.round(borderWidth * 0.5);

      // The stamp area: separator line is at (borderWidth + docHeight + borderWidth*0.5)
      // Stamp text starts at separator + borderWidth*0.5
      // The TXID blank line is 2nd-to-last in the stamp.
      // From the bottom: the last line is "bit-sign.online" (smallFont).
      // Above that is the blank TXID line. So TXID Y = imgH - borderWidth*1.5 - lineHeight*2
      const smallFont = Math.round(stampFontSize * 0.85);
      const txidY = imgH - Math.round(borderWidth * 1.5) - lineHeight * 2;

      const txidText = txid.startsWith('pending-')
        ? '' // Don't write anything if inscription failed
        : `TXID: ${txid}`;

      if (txidText) {
        const displayTxid = txidText.length > 60 ? txidText.slice(0, 57) + '...' : txidText;
        const svgOverlay = Buffer.from(`<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
          <text x="${stampTextX}" y="${txidY + stampFontSize}" font-family="monospace" font-size="${stampFontSize}" fill="#22c55e">${displayTxid.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
        </svg>`);

        let pipeline = sharp(imgBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]);
        if (isJpeg) pipeline = pipeline.jpeg({ quality: 85 });
        else pipeline = pipeline.png();
        const result = await pipeline.toBuffer();
        finalBase64 = result.toString('base64');
      }
    } catch (burnErr) {
      console.warn('[seal] TXID burn failed (non-fatal):', burnErr);
    }

    // Store sealed document as new vault item
    const { data: sealed, error: sealError } = await supabaseAdmin
      .from('bit_sign_signatures')
      .insert({
        user_handle: handle,
        signature_type: 'SEALED_DOCUMENT',
        payload_hash: compositeHash,
        encrypted_payload: finalBase64,
        iv: null,
        txid,
        metadata: {
          type: 'Sealed Document',
          originalDocumentId,
          originalFileName,
          placement,
          elements: elements || undefined,
          mimeType: isJpeg ? 'image/jpeg' : 'image/png',
          walletAddress,
          walletSignature,
          paymentTxid,
        },
        encryption_version: 0,
        wallet_signed: !!walletSignature,
        wallet_signature: walletSignature || null,
        wallet_address: walletAddress || null,
      })
      .select()
      .single();

    if (sealError) throw sealError;

    // Create vault_item/SEALED_DOCUMENT strand
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
          strandType: 'vault_item',
          strandSubtype: 'SEALED_DOCUMENT',
          signatureId: sealed.id,
          label: 'Sealed Document',
          userHandle: handle,
        });
      }
    } catch (strandErr) {
      console.warn('[seal] Strand creation failed (non-fatal):', strandErr);
    }

    return NextResponse.json({
      success: true,
      id: sealed.id,
      txid,
      inscription: inscriptionResult ? {
        transactionId: inscriptionResult.transactionId,
        explorerUrl: `https://whatsonchain.com/tx/${inscriptionResult.transactionId}`,
      } : null,
    });
  } catch (error: any) {
    console.error('[seal] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to seal document' }, { status: 500 });
  }
}
