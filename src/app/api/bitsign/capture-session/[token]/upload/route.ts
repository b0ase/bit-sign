import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Validate session (phone checks if token is valid before showing camera)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    const { data: session, error } = await supabaseAdmin
        .from('capture_sessions')
        .select('capture_mode, status, expires_at')
        .eq('session_token', token)
        .single();

    if (error || !session) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
    }

    if (new Date(session.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Session expired' }, { status: 410 });
    }

    if (session.status !== 'pending') {
        return NextResponse.json({ error: 'Session already used' }, { status: 409 });
    }

    return NextResponse.json({
        captureMode: session.capture_mode,
        expiresAt: session.expires_at,
    });
}

// POST: Upload captured media (phone sends photo/video)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    try {
        const { mediaData, mediaMimeType } = await request.json();

        if (!mediaData || !mediaMimeType) {
            return NextResponse.json({ error: 'Missing media data' }, { status: 400 });
        }

        // 6MB base64 limit (~4.5MB raw)
        if (mediaData.length > 6 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 6MB)' }, { status: 413 });
        }

        const { data: session, error: fetchError } = await supabaseAdmin
            .from('capture_sessions')
            .select('*')
            .eq('session_token', token)
            .single();

        if (fetchError || !session) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
        }

        if (new Date(session.expires_at) < new Date()) {
            return NextResponse.json({ error: 'Session expired' }, { status: 410 });
        }

        if (session.status !== 'pending') {
            return NextResponse.json({ error: 'Session already used' }, { status: 409 });
        }

        const { error: updateError } = await supabaseAdmin
            .from('capture_sessions')
            .update({
                status: 'captured',
                media_data: mediaData,
                media_mime_type: mediaMimeType,
                captured_at: new Date().toISOString(),
            })
            .eq('id', session.id);

        if (updateError) {
            console.error('[capture-upload] DB update error:', updateError);
            return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[capture-upload] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
