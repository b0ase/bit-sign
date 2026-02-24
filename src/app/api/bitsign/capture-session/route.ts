import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    const handle = await resolveUserHandle(request);
    if (!handle) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { captureMode } = await request.json();
        if (!captureMode || !['PHOTO', 'VIDEO'].includes(captureMode)) {
            return NextResponse.json({ error: 'Invalid capture mode' }, { status: 400 });
        }

        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        const { error } = await supabaseAdmin
            .from('capture_sessions')
            .insert({
                session_token: sessionToken,
                user_handle: handle,
                capture_mode: captureMode,
                status: 'pending',
                expires_at: expiresAt.toISOString(),
            });

        if (error) {
            console.error('[capture-session] DB insert error:', error);
            return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
        }

        return NextResponse.json({
            sessionToken,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (err) {
        console.error('[capture-session] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
