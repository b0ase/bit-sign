import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData, hashData } from '@/lib/bsv-inscription';
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
      const { data: grant } = await supabaseAdmin
        .from('document_access_grants')
        .select('id')
        .eq('document_id', originalDocumentId)
        .eq('grantee_handle', handle)
        .is('revoked_at', null)
        .maybeSingle();

      if (!grant) {
        return NextResponse.json({ error: 'Document not found or not yours' }, { status: 404 });
      }
    }

    const originalFileName = originalDoc.metadata?.fileName || originalDoc.metadata?.type || 'Document';

    // Hash the composite image data
    const compositeHash = await hashData(compositeData);

    // Inscribe on-chain
    let txid: string;
    let inscriptionResult = null;

    try {
      inscriptionResult = await inscribeBitSignData({
        type: 'document_signature',
        documentHash: compositeHash,
        signerName: handle,
        walletAddress: walletAddress || '',
        walletType: 'handcash',
        signedAt: new Date().toISOString(),
      });
      txid = inscriptionResult.txid;
    } catch (inscribeError) {
      console.warn('[seal] Blockchain inscription failed, recording locally:', inscribeError);
      txid = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // Burn the TXID onto the seal stamp in the image
    let finalBase64 = compositeData.replace(/^data:image\/\w+;base64,/, '');
    const isJpeg = compositeData.startsWith('data:image/jpeg');

    try {
      const imgBuffer = Buffer.from(finalBase64, 'base64');
      const metadata = await sharp(imgBuffer).metadata();
      const imgW = metadata.width || 800;
      const imgH = metadata.height || 600;

      // Calculate stamp position and font size to match client-side rendering
      const stampFontSize = Math.max(12, Math.round(imgW * 0.014));
      const txidText = txid.startsWith('pending-') ? `REF: ${txid}` : `TXID: ${txid}`;
      // Truncate very long TXIDs for display
      const displayTxid = txidText.length > 50 ? txidText.slice(0, 47) + '...' : txidText;

      // The "TXID: pending..." line is the 2nd-to-last line in the stamp.
      // We need to find where the stamp is and overlay the real TXID.
      // The stamp is at bottom-right. We estimate its position based on the font metrics.
      // Build an SVG overlay that places the TXID text at the correct position.
      const stampPad = Math.round(imgW * 0.02);
      // We need to find the placeholder text location. Since we know the stamp structure,
      // the TXID line is at a known offset from the bottom.
      // Approach: overlay a filled rect + text at the TXID line position.
      // The TXID line is 2nd from bottom in the stamp. Line height = stampFontSize * 1.4
      const lineHeight = Math.round(stampFontSize * 1.4);
      // TXID line is 1 line up from bottom text ("bit-sign.online") + stampPad
      const txidLineBottomOffset = stampPad + lineHeight + Math.round(stampFontSize * 0.85 * 1.4);

      const svgOverlay = Buffer.from(`<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .txid { font: ${stampFontSize}px monospace; fill: #22c55e; }
        </style>
        <rect x="${imgW - Math.round(imgW * 0.45)}" y="${imgH - txidLineBottomOffset - lineHeight}" width="${Math.round(imgW * 0.43)}" height="${lineHeight}" fill="rgba(0,0,0,0.9)" />
        <text x="${imgW - Math.round(imgW * 0.44)}" y="${imgH - txidLineBottomOffset - 2}" class="txid">${displayTxid.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
      </svg>`);

      let pipeline = sharp(imgBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]);
      if (isJpeg) pipeline = pipeline.jpeg({ quality: 85 });
      else pipeline = pipeline.png();
      const result = await pipeline.toBuffer();

      finalBase64 = result.toString('base64');
    } catch (burnErr) {
      console.warn('[seal] TXID burn failed (non-fatal, using original image):', burnErr);
      // Fall through with original image
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
        dataHash: inscriptionResult.dataHash,
        explorerUrl: inscriptionResult.blockchainExplorerUrl,
      } : null,
    });
  } catch (error: any) {
    console.error('[seal] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to seal document' }, { status: 500 });
  }
}
