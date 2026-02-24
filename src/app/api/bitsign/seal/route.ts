import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData, hashData } from '@/lib/bsv-inscription';

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

    // Verify original document belongs to user
    const { data: originalDoc } = await supabaseAdmin
      .from('bit_sign_signatures')
      .select('id, signature_type, metadata')
      .eq('id', originalDocumentId)
      .eq('user_handle', handle)
      .single();

    if (!originalDoc) {
      return NextResponse.json({ error: 'Document not found or not yours' }, { status: 404 });
    }

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

    // Strip data URL prefix to get raw base64 for storage
    const base64Payload = compositeData.replace(/^data:image\/\w+;base64,/, '');

    // Store sealed document as new vault item
    const { data: sealed, error: sealError } = await supabaseAdmin
      .from('bit_sign_signatures')
      .insert({
        user_handle: handle,
        signature_type: 'SEALED_DOCUMENT',
        payload_hash: compositeHash,
        encrypted_payload: base64Payload,
        iv: null,
        txid,
        metadata: {
          type: 'Sealed Document',
          originalDocumentId,
          placement,
          elements: elements || undefined,
          mimeType: 'image/png',
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
