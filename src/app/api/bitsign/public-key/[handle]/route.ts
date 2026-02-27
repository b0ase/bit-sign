import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET — Return the public key for any handle (needed for sharing).
 * Public endpoint — no auth required.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ handle: string }> }
) {
    try {
        const { handle } = await params;

        if (!handle) {
            return NextResponse.json({ error: 'Handle required' }, { status: 400 });
        }

        // Look up unified user by handle
        const { data: identity } = await supabaseAdmin
            .from('user_identities')
            .select('unified_user_id')
            .eq('provider', 'handcash')
            .eq('provider_user_id', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ error: 'HandCash user not found. They must sign in with HandCash first.' }, { status: 404 });
        }

        const { data: user } = await supabaseAdmin
            .from('unified_users')
            .select('public_key')
            .eq('id', identity.unified_user_id)
            .single();

        if (!user?.public_key) {
            return NextResponse.json({ error: 'Recipient has not set up E2E encryption yet. Ask them to sign in to Bit-Sign first.' }, { status: 404 });
        }

        return NextResponse.json({
            handle,
            public_key: user.public_key,
        });
    } catch (error: any) {
        console.error('[public-key] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to get public key' }, { status: 500 });
    }
}
