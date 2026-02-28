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
      txidPosition,
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

    // Inscribe on-chain via user's HandCash wallet — REQUIRED for seal
    const authToken = request.cookies.get('handcash_auth_token')?.value;
    const userAccount = authToken ? getUserAccount(authToken) : null;

    if (!userAccount) {
      return NextResponse.json({ error: 'HandCash wallet not connected. Please reconnect and try again.' }, { status: 401 });
    }

    let txid: string;
    let inscriptionResult: { transactionId: string };

    try {
      const inscriptionData = {
        protocol: 'b0ase-bitsign',
        version: '1.0',
        type: 'document_seal',
        documentHash: compositeHash,
        signerHandle: handle,
        originalDocumentId,
        originalFileName,
        sealedAt: new Date().toISOString(),
      };

      const shortName = originalFileName.length > 12 ? originalFileName.slice(0, 12) + '…' : originalFileName;
      const paymentResult = await userAccount.wallet.pay({
        description: `Seal: ${shortName}`,
        appAction: 'seal',
        payments: [
          { destination: 'boase', currencyCode: 'BSV', sendAmount: 0.001 },
        ],
        attachment: { format: 'json', value: inscriptionData },
      });

      txid = paymentResult.transactionId;
      inscriptionResult = paymentResult;
      console.log(`[seal] On-chain inscription: ${txid} (paid to $boase)`);
    } catch (inscribeError: any) {
      console.error('[seal] HandCash inscription failed:', inscribeError?.message || inscribeError);
      return NextResponse.json({
        error: `Blockchain inscription failed: ${inscribeError?.message || 'Unknown wallet error'}. Please check your HandCash balance and try again.`,
      }, { status: 502 });
    }

    // Burn the TXID onto the seal stamp using exact coordinates from the client.
    let finalBase64 = compositeData.replace(/^data:image\/\w+;base64,/, '');
    const isJpeg = compositeData.startsWith('data:image/jpeg');

    try {
      const imgBuffer = Buffer.from(finalBase64, 'base64');
      const imgMeta = await sharp(imgBuffer).metadata();
      const imgW = imgMeta.width || 800;
      const imgH = imgMeta.height || 600;

      // Use exact pixel coordinates sent by the client
      const txX = txidPosition?.x || Math.round(imgW * 0.06);
      const txY = txidPosition?.y || Math.round(imgH * 0.92);
      const txFontSize = txidPosition?.fontSize || Math.max(14, Math.round(imgW * 0.015));

      const txidLabel = `TXID: ${txid}`;
      const svgOverlay = Buffer.from(`<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
        <text x="${txX}" y="${txY + txFontSize}" font-family="monospace" font-size="${txFontSize}" fill="#22c55e">${txidLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
      </svg>`);

      let pipeline = sharp(imgBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]);
      if (isJpeg) pipeline = pipeline.jpeg({ quality: 85 });
      else pipeline = pipeline.png();
      const result = await pipeline.toBuffer();
      finalBase64 = result.toString('base64');
      console.log(`[seal] TXID burned at (${txX}, ${txY}) fontSize=${txFontSize}`);
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
      inscription: {
        transactionId: inscriptionResult.transactionId,
        explorerUrl: `https://whatsonchain.com/tx/${inscriptionResult.transactionId}`,
      },
    });
  } catch (error: any) {
    console.error('[seal] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to seal document' }, { status: 500 });
  }
}
