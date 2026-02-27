import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/bitsign/call
 * Initiate a video call to another user by handle or email.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { calleeHandle, calleeEmail } = await request.json();

        if (!calleeHandle && !calleeEmail) {
            return NextResponse.json({ error: 'Must provide calleeHandle or calleeEmail' }, { status: 400 });
        }

        let resolvedHandle = calleeHandle?.replace(/^\$/, '') || null;
        let resolvedEmail = calleeEmail || null;

        // If handle field looks like an email, treat it as email
        if (resolvedHandle && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedHandle)) {
            resolvedEmail = resolvedEmail || resolvedHandle;
            resolvedHandle = null;
        }

        // If we have an email but no handle, try to resolve from known identities
        if (!resolvedHandle && resolvedEmail) {
            const { data: identityByEmail } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('user_handle')
                .or(`google_email.eq.${resolvedEmail},microsoft_email.eq.${resolvedEmail}`)
                .maybeSingle();
            if (identityByEmail) {
                resolvedHandle = identityByEmail.user_handle;
            }
        }

        if (resolvedHandle === handle) {
            return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 });
        }

        if (!resolvedHandle) {
            return NextResponse.json({ error: 'Could not resolve callee. They must have a Bit-Sign account.' }, { status: 404 });
        }

        // Cancel any existing ringing calls from this caller to this callee
        await supabaseAdmin
            .from('video_call_requests')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('caller_handle', handle)
            .eq('callee_handle', resolvedHandle)
            .eq('status', 'ringing');

        // Create the call request
        const { data: call, error: insertError } = await supabaseAdmin
            .from('video_call_requests')
            .insert({
                caller_handle: handle,
                callee_handle: resolvedHandle,
                callee_email: resolvedEmail,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            callId: call.id,
            roomToken: call.room_token,
        });
    } catch (error: any) {
        console.error('[call] POST Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to initiate call' }, { status: 500 });
    }
}

/**
 * GET /api/bitsign/call
 * Fetch incoming ringing calls for the current user.
 * Also auto-expires calls older than 60 seconds.
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Auto-expire stale ringing calls (older than 60s)
        const expiryCutoff = new Date(Date.now() - 60_000).toISOString();
        await supabaseAdmin
            .from('video_call_requests')
            .update({ status: 'missed' })
            .eq('status', 'ringing')
            .lt('created_at', expiryCutoff);

        // Fetch ringing calls for this user
        const { data: calls, error } = await supabaseAdmin
            .from('video_call_requests')
            .select('*')
            .eq('callee_handle', handle)
            .eq('status', 'ringing')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ calls: calls || [] });
    } catch (error: any) {
        console.error('[call] GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch calls' }, { status: 500 });
    }
}
