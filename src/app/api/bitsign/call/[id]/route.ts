import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PATCH /api/bitsign/call/[id]
 * Accept, reject, or end a call.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action } = await request.json();

        if (!['accept', 'reject', 'end'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action. Must be accept, reject, or end.' }, { status: 400 });
        }

        // Fetch the call
        const { data: call } = await supabaseAdmin
            .from('video_call_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (!call) {
            return NextResponse.json({ error: 'Call not found' }, { status: 404 });
        }

        // Verify the user is a participant
        if (call.caller_handle !== handle && call.callee_handle !== handle) {
            return NextResponse.json({ error: 'Not a participant in this call' }, { status: 403 });
        }

        const now = new Date().toISOString();

        if (action === 'accept') {
            if (call.status !== 'ringing') {
                return NextResponse.json({ error: 'Call is no longer ringing' }, { status: 400 });
            }
            await supabaseAdmin
                .from('video_call_requests')
                .update({ status: 'active', answered_at: now })
                .eq('id', id);
        } else if (action === 'reject') {
            if (call.status !== 'ringing') {
                return NextResponse.json({ error: 'Call is no longer ringing' }, { status: 400 });
            }
            await supabaseAdmin
                .from('video_call_requests')
                .update({ status: 'ended', ended_at: now })
                .eq('id', id);
        } else if (action === 'end') {
            await supabaseAdmin
                .from('video_call_requests')
                .update({ status: 'ended', ended_at: now })
                .eq('id', id);
        }

        return NextResponse.json({ success: true, roomToken: call.room_token });
    } catch (error: any) {
        console.error('[call/id] PATCH Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update call' }, { status: 500 });
    }
}
