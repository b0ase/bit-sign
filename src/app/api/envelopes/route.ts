import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { renderDocument, getTemplate } from '@/lib/templates';
import { hashData } from '@/lib/bsv-inscription';
import { handCashConnect } from '@/lib/handcash';

/**
 * POST /api/envelopes — Create a new signing envelope
 */
export async function POST(request: NextRequest) {
  try {
    const handle = request.cookies.get('handcash_handle')?.value;
    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, template_id, variables, signers, expires_in_days } = body;

    if (!title || !template_id || !signers || !Array.isArray(signers) || signers.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields: title, template_id, signers[]'
      }, { status: 400 });
    }

    const template = getTemplate(template_id);
    if (!template) {
      return NextResponse.json({ error: `Template not found: ${template_id}` }, { status: 400 });
    }

    // Render the document HTML
    const documentHtml = renderDocument(template_id, variables || {});
    const documentHash = await hashData(documentHtml);

    // Build signers with signing tokens
    const enrichedSigners = signers.map((s: any, i: number) => ({
      name: s.name,
      email: s.email || null,
      handle: s.handle || null,
      role: s.role,
      order: s.order ?? i + 1,
      status: 'pending',
      signed_at: null,
      signature_data: null,
      signing_token: crypto.randomUUID(),
    }));

    // Calculate expiry
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null;

    const { data: envelope, error } = await supabaseAdmin
      .from('signing_envelopes')
      .insert({
        title,
        document_type: template_id,
        status: 'pending',
        document_html: documentHtml,
        document_hash: documentHash,
        created_by_handle: handle,
        signers: enrichedSigners,
        expires_at: expiresAt,
        metadata: { template_id, variables: variables || {} },
      })
      .select()
      .single();

    if (error) {
      console.error('[envelopes] Create error:', error);
      return NextResponse.json({ error: 'Failed to create envelope' }, { status: 500 });
    }

    // Build signing URLs
    const signingUrls = enrichedSigners.map((s: any) => ({
      name: s.name,
      role: s.role,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online'}/sign/${s.signing_token}`,
    }));

    // Send HandCash notifications to signers with handles
    const notified: string[] = [];
    if (handCashConnect && process.env.HOUSE_AUTH_TOKEN) {
      const houseAccount = handCashConnect.getAccountFromAuthToken(process.env.HOUSE_AUTH_TOKEN);
      for (const s of enrichedSigners) {
        if (s.handle) {
          try {
            const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online'}/sign/${s.signing_token}`;
            const service = (houseAccount as any).handCashConnectService;
            const requestParams = {
              description: `Bit-Sign: ${handle} sent you "${title}" to sign`,
              payments: [{
                destination: s.handle.startsWith('$') ? s.handle : `$${s.handle}`,
                currencyCode: 'USD',
                sendAmount: 0.01,
              }],
              expiration: new Date(Date.now() + 30 * 86400000).toISOString(),
              customData: {
                message: `Please sign: ${title}`,
                callbackUrl: signingUrl,
                source: 'Bit-Sign',
              },
            };
            const httpRequest = service.getRequest('POST', '/v1/connect/wallet/paymentRequest', requestParams);
            await fetch(httpRequest.url, httpRequest);
            notified.push(s.handle);
          } catch (err) {
            console.warn(`[envelopes] Failed to notify ${s.handle}:`, err);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      envelope: {
        id: envelope.id,
        title: envelope.title,
        status: envelope.status,
        document_hash: envelope.document_hash,
        created_at: envelope.created_at,
      },
      signing_urls: signingUrls,
      notified_handles: notified,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[envelopes] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/envelopes — List user's envelopes
 */
export async function GET(request: NextRequest) {
  try {
    const handle = request.cookies.get('handcash_handle')?.value;
    if (!handle) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: envelopes, error } = await supabaseAdmin
      .from('signing_envelopes')
      .select('id, title, document_type, status, document_hash, signers, inscription_txid, created_at, updated_at, expires_at')
      .eq('created_by_handle', handle)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[envelopes] List error:', error);
      return NextResponse.json({ error: 'Failed to fetch envelopes' }, { status: 500 });
    }

    // Also find envelopes where this user is a signer
    const { data: signerEnvelopes } = await supabaseAdmin
      .from('signing_envelopes')
      .select('id, title, document_type, status, document_hash, signers, inscription_txid, created_at, updated_at, expires_at')
      .neq('created_by_handle', handle)
      .contains('signers', JSON.stringify([{ handle }]))
      .order('created_at', { ascending: false });

    return NextResponse.json({
      created: envelopes || [],
      to_sign: signerEnvelopes || [],
    });
  } catch (error: any) {
    console.error('[envelopes] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
