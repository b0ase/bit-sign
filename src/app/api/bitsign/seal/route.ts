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

// ─── Pixel font renderer (no system fonts needed) ─────────────────────
// 5x7 bitmap glyphs for hex chars + TXID label chars. Each glyph is an
// array of 7 strings, each string 5 chars wide ('X' = filled, '.' = empty).
const PIXEL_FONT: Record<string, string[]> = {
  'T': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  'X': ['X...X', '.X.X.', '..X..', '..X..', '..X..', '.X.X.', 'X...X'],
  'I': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  'D': ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  ':': ['.....', '..X..', '..X..', '.....', '..X..', '..X..', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  '2': ['.XXX.', 'X...X', '....X', '..XX.', '.X...', 'X....', 'XXXXX'],
  '3': ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'XXXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
  'a': ['.....', '.....', '.XXX.', '....X', '.XXXX', 'X...X', '.XXXX'],
  'b': ['X....', 'X....', 'XXXX.', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  'c': ['.....', '.....', '.XXXX', 'X....', 'X....', 'X....', '.XXXX'],
  'd': ['....X', '....X', '.XXXX', 'X...X', 'X...X', 'X...X', '.XXXX'],
  'e': ['.....', '.....', '.XXX.', 'X...X', 'XXXXX', 'X....', '.XXX.'],
  'f': ['..XX.', '.X...', 'XXXX.', '.X...', '.X...', '.X...', '.X...'],
};

/** Render a string as an SVG buffer using the pixel font (no system fonts). */
function renderPixelText(text: string, fontSize: number, color: string): Buffer {
  const pixelSize = Math.max(1, Math.round(fontSize / 9));
  const charW = 5 * pixelSize;
  const charH = 7 * pixelSize;
  const gap = pixelSize; // 1-pixel gap between characters
  const totalW = text.length * (charW + gap);
  const totalH = charH + pixelSize * 2; // small padding

  let rects = '';
  for (let ci = 0; ci < text.length; ci++) {
    const ch = text[ci];
    const glyph = PIXEL_FONT[ch];
    if (!glyph) continue; // skip unknown chars
    const baseX = ci * (charW + gap);
    const baseY = pixelSize; // top padding
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === 'X') {
          rects += `<rect x="${baseX + col * pixelSize}" y="${baseY + row * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}"/>`;
        }
      }
    }
  }

  return Buffer.from(
    `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
  );
}

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
        walletAddress: walletAddress || undefined,
        originalDocumentId,
        originalFileName,
        sealedAt: new Date().toISOString(),
      };

      const shortName = originalFileName.length > 12 ? originalFileName.slice(0, 12) + '…' : originalFileName;
      const paymentResult = await userAccount.wallet.pay({
        description: `Seal: ${shortName}`,
        appAction: 'seal',
        payments: [
          { destination: 'signature', currencyCode: 'BSV', sendAmount: 0.001 },
        ],
        attachment: { format: 'json', value: inscriptionData },
      });

      txid = paymentResult.transactionId;
      inscriptionResult = paymentResult;
      console.log(`[seal] On-chain inscription: ${txid} (paid to $signature)`);
    } catch (inscribeError: any) {
      console.error('[seal] HandCash inscription failed:', inscribeError?.message || inscribeError);
      return NextResponse.json({
        error: `Blockchain inscription failed: ${inscribeError?.message || 'Unknown wallet error'}. Please check your HandCash balance and try again.`,
      }, { status: 502 });
    }

    // Burn the TXID onto the seal stamp — REQUIRED, not optional.
    // Two-step: render TXID text as a small PNG strip, then composite onto the document.
    let finalBase64 = compositeData.replace(/^data:image\/\w+;base64,/, '');
    const isJpeg = compositeData.startsWith('data:image/jpeg');

    const imgBuffer = Buffer.from(finalBase64, 'base64');
    const imgMeta = await sharp(imgBuffer).metadata();
    const imgW = imgMeta.width || 800;
    const imgH = imgMeta.height || 600;

    // Use exact pixel coordinates sent by the client, or fallback
    const txX = txidPosition?.x || Math.round(imgW * 0.06);
    const txY = txidPosition?.y || Math.round(imgH * 0.92);
    const txFontSize = txidPosition?.fontSize || Math.max(14, Math.round(imgW * 0.015));

    const txidLabel = `TXID: ${txid}`;
    // Render TXID using pixel font (SVG <rect> elements) — no system fonts needed.
    // This guarantees text renders correctly in Vercel serverless (librsvg has no fonts).
    const maxStripW = imgW - txX;
    const maxStripH = imgH - txY;
    const txidSvgBuf = renderPixelText(txidLabel, txFontSize, '#22c55e');
    let txidPngBuffer = await sharp(txidSvgBuf).png().toBuffer();
    let txidPngMeta = await sharp(txidPngBuffer).metadata();

    // Scale down if the strip exceeds available space
    const stripW = txidPngMeta.width || 0;
    const stripH = txidPngMeta.height || 0;
    if (stripW > maxStripW || stripH > maxStripH) {
      const scale = Math.min(maxStripW / stripW, maxStripH / stripH, 1);
      const newW = Math.max(1, Math.round(stripW * scale));
      txidPngBuffer = await sharp(txidPngBuffer).resize(newW).png().toBuffer();
      txidPngMeta = await sharp(txidPngBuffer).metadata();
    }
    console.log(`[seal] TXID text strip: ${txidPngMeta.width}x${txidPngMeta.height} → position (${txX}, ${txY}), available ${maxStripW}x${maxStripH}`);

    // Composite the TXID PNG onto the main image at the exact position
    let pipeline = sharp(imgBuffer).composite([{
      input: txidPngBuffer,
      top: txY,
      left: txX,
    }]);
    if (isJpeg) pipeline = pipeline.jpeg({ quality: 85 });
    else pipeline = pipeline.png();
    const burnedResult = await pipeline.toBuffer();
    finalBase64 = burnedResult.toString('base64');

    // Re-hash the final image (with TXID baked in) for the stored record
    const finalHash = await hashData(`data:image/${isJpeg ? 'jpeg' : 'png'};base64,${finalBase64}`);
    console.log(`[seal] TXID burned successfully. Pre-TXID hash: ${compositeHash.slice(0, 16)}... Final hash: ${finalHash.slice(0, 16)}...`);

    // Second inscription: confirm finalHash on-chain (non-fatal)
    let confirmationTxid: string | null = null;
    try {
      const confirmData = {
        protocol: 'b0ase-bitsign',
        version: '1.0',
        type: 'document_seal_confirmation',
        finalHash,
        sealTxid: txid,
        preInscriptionHash: compositeHash,
        signerHandle: handle,
        walletAddress: walletAddress || undefined,
        confirmedAt: new Date().toISOString(),
      };

      const confirmResult = await userAccount.wallet.pay({
        description: 'Seal confirm',
        appAction: 'seal-confirm',
        payments: [
          { destination: 'signature', currencyCode: 'BSV', sendAmount: 0.00001 },
        ],
        attachment: { format: 'json', value: confirmData },
      });

      confirmationTxid = confirmResult.transactionId;
      console.log(`[seal] Confirmation inscription: ${confirmationTxid}`);
    } catch (confirmErr: any) {
      console.warn('[seal] Confirmation inscription failed (non-fatal):', confirmErr?.message || confirmErr);
    }

    // Store sealed document as new vault item
    const { data: sealed, error: sealError } = await supabaseAdmin
      .from('bit_sign_signatures')
      .insert({
        user_handle: handle,
        signature_type: 'SEALED_DOCUMENT',
        payload_hash: finalHash,
        encrypted_payload: finalBase64,
        iv: null,
        txid,
        metadata: {
          type: 'Sealed Document',
          originalDocumentId,
          originalFileName,
          preInscriptionHash: compositeHash,
          placement,
          elements: elements || undefined,
          mimeType: isJpeg ? 'image/jpeg' : 'image/png',
          walletAddress,
          walletSignature,
          paymentTxid,
          confirmationTxid,
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
      confirmation: confirmationTxid ? {
        transactionId: confirmationTxid,
        explorerUrl: `https://whatsonchain.com/tx/${confirmationTxid}`,
      } : null,
    });
  } catch (error: any) {
    console.error('[seal] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to seal document' }, { status: 500 });
  }
}
