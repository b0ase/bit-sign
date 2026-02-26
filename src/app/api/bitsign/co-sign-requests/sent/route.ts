import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/bitsign/co-sign-requests/sent
 * List co-sign requests sent by the current user with their status.
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: requests, error } = await supabaseAdmin
            .from('co_sign_requests')
            .select('*')
            .eq('sender_handle', handle)
            .neq('sender_dismissed', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with document metadata
        const enriched = await Promise.all(
            (requests || []).map(async (req) => {
                const { data: sig } = await supabaseAdmin
                    .from('bit_sign_signatures')
                    .select('signature_type, metadata, txid')
                    .eq('id', req.document_id)
                    .maybeSingle();

                // Resolve real name — walk up seal chain if needed
                let docName = sig?.metadata?.originalFileName || sig?.metadata?.fileName || null;
                if (!docName || docName === 'Sealed Document') {
                    let walkDocId = sig?.metadata?.originalDocumentId;
                    let depth = 0;
                    while (walkDocId && depth < 5) {
                        const { data: parentDoc } = await supabaseAdmin
                            .from('bit_sign_signatures')
                            .select('metadata')
                            .eq('id', walkDocId)
                            .maybeSingle();
                        if (!parentDoc) break;
                        const name = parentDoc.metadata?.fileName || parentDoc.metadata?.originalFileName;
                        if (name && name !== 'Sealed Document') { docName = name; break; }
                        walkDocId = parentDoc.metadata?.originalDocumentId;
                        depth++;
                    }
                }

                return {
                    ...req,
                    document_name: docName || 'Document',
                    document_txid: sig?.txid,
                };
            })
        );

        return NextResponse.json({ requests: enriched });
    } catch (error: any) {
        console.error('[co-sign-requests/sent] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sent requests' }, { status: 500 });
    }
}
