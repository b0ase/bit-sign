import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const handle = await resolveUserHandle(request);
    if (!handle) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;

    const { data: session, error } = await supabaseAdmin
        .from('capture_sessions')
        .select('*')
        .eq('session_token', token)
        .eq('user_handle', handle)
        .single();

    if (error || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
        return NextResponse.json({
            status: 'expired',
            captureMode: session.capture_mode,
        });
    }

    if (session.status === 'captured' && session.media_data) {
        // Return captured media then mark session as consumed
        await supabaseAdmin
            .from('capture_sessions')
            .update({ status: 'consumed' })
            .eq('id', session.id);

        return NextResponse.json({
            status: 'captured',
            captureMode: session.capture_mode,
            mediaData: session.media_data,
            mediaMimeType: session.media_mime_type,
        });
    }

    return NextResponse.json({
        status: session.status,
        captureMode: session.capture_mode,
        expiresAt: session.expires_at,
    });
}
