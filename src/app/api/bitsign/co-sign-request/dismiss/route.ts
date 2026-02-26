import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/bitsign/co-sign-request/dismiss
 * Dismiss (soft-delete) a co-sign request from the user's view.
 * Works for both sent and received requests.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { requestId } = await request.json();
        if (!requestId) {
            return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        }

        // Verify this request belongs to the user (as sender or recipient)
        const { data: req } = await supabaseAdmin
            .from('co_sign_requests')
            .select('id, sender_handle, recipient_handle')
            .eq('id', requestId)
            .maybeSingle();

        if (!req) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const isSender = req.sender_handle === handle;
        const isRecipient = req.recipient_handle === handle;

        if (!isSender && !isRecipient) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }

        // Set dismissed flag for the appropriate party
        const updateField = isSender ? 'sender_dismissed' : 'recipient_dismissed';
        const { error } = await supabaseAdmin
            .from('co_sign_requests')
            .update({ [updateField]: true })
            .eq('id', requestId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[co-sign-request/dismiss] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to dismiss' }, { status: 500 });
    }
}
