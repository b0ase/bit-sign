import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/bitsign/co-sign-request/claim
 * Claim a co-sign request via claim_token. Links the current user's handle
 * to the request and creates an access grant for the document.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { claimToken } = await request.json();
        if (!claimToken) {
            return NextResponse.json({ error: 'Missing claimToken' }, { status: 400 });
        }

        // Find the co-sign request by claim token
        const { data: req } = await supabaseAdmin
            .from('co_sign_requests')
            .select('*')
            .eq('claim_token', claimToken)
            .eq('status', 'pending')
            .maybeSingle();

        if (!req) {
            return NextResponse.json({ error: 'Co-sign request not found or already completed' }, { status: 404 });
        }

        // Don't let the sender claim their own request
        if (req.sender_handle === handle) {
            return NextResponse.json({ error: 'Cannot claim your own request' }, { status: 400 });
        }

        // If already claimed by someone else, reject
        if (req.recipient_handle && req.recipient_handle !== handle) {
            return NextResponse.json({ error: 'Already claimed by another user' }, { status: 403 });
        }

        // Link the handle to the request
        if (!req.recipient_handle) {
            await supabaseAdmin
                .from('co_sign_requests')
                .update({ recipient_handle: handle })
                .eq('id', req.id);
        }

        // Create access grant if missing
        const { data: existingGrant } = await supabaseAdmin
            .from('document_access_grants')
            .select('id')
            .eq('document_id', req.document_id)
            .eq('grantee_handle', handle)
            .is('revoked_at', null)
            .maybeSingle();

        if (!existingGrant) {
            await supabaseAdmin
                .from('document_access_grants')
                .insert({
                    document_id: req.document_id,
                    document_type: 'vault_item',
                    grantor_handle: req.sender_handle,
                    grantee_handle: handle,
                    wrapped_key: 'co-sign-request',
                    encryption_version: 0,
                });
        }

        return NextResponse.json({ success: true, requestId: req.id });
    } catch (error: any) {
        console.error('[co-sign-request/claim] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to claim' }, { status: 500 });
    }
}
