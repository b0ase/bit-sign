import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * GET — Return user's E2E keypair data (encrypted private key + public key).
 * POST — Store keypair generated client-side.
 */

export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Look up unified user
        const { data: identity } = await supabaseAdmin
            .from('user_identities')
            .select('unified_user_id')
            .eq('provider', 'handcash')
            .eq('provider_user_id', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { data: user } = await supabaseAdmin
            .from('unified_users')
            .select('public_key, encrypted_private_key, private_key_iv')
            .eq('id', identity.unified_user_id)
            .single();

        return NextResponse.json({
            public_key: user?.public_key || null,
            encrypted_private_key: user?.encrypted_private_key || null,
            private_key_iv: user?.private_key_iv || null,
        });
    } catch (error: any) {
        console.error('[keypair GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to get keypair' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { public_key, encrypted_private_key, private_key_iv } = await request.json();

        if (!public_key || !encrypted_private_key || !private_key_iv) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Look up unified user
        const { data: identity } = await supabaseAdmin
            .from('user_identities')
            .select('unified_user_id')
            .eq('provider', 'handcash')
            .eq('provider_user_id', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Store keypair
        const { error: updateError } = await supabaseAdmin
            .from('unified_users')
            .update({
                public_key,
                encrypted_private_key,
                private_key_iv,
            })
            .eq('id', identity.unified_user_id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[keypair POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to store keypair' }, { status: 500 });
    }
}
