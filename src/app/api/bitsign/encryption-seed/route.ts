import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * Returns a persistent encryption key for client-side encryption.
 * The key is generated once per user and stored in the database,
 * so it survives HandCash re-authentication (unlike session-derived keys).
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);

        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Look up the unified user by handle → user_identities → unified_users
        const { data: identity } = await supabaseAdmin
            .from('user_identities')
            .select('unified_user_id')
            .eq('provider', 'handcash')
            .eq('provider_user_id', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if user already has a stored encryption key on unified_users
        const { data: user } = await supabaseAdmin
            .from('unified_users')
            .select('encryption_key')
            .eq('id', identity.unified_user_id)
            .single();

        if (user?.encryption_key) {
            return NextResponse.json({
                success: true,
                encryptionSeed: user.encryption_key,
            });
        }

        // Generate a permanent encryption key (64 hex chars = 256 bits)
        const keyBytes = new Uint8Array(32);
        crypto.getRandomValues(keyBytes);
        const encryptionKey = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // Store it on unified_users
        const { error: updateError } = await supabaseAdmin
            .from('unified_users')
            .update({ encryption_key: encryptionKey })
            .eq('id', identity.unified_user_id);

        if (updateError) {
            console.error('[encryption-seed] Failed to store key:', updateError);
        }

        return NextResponse.json({
            success: true,
            encryptionSeed: encryptionKey,
        });
    } catch (error: any) {
        console.error('Encryption Seed Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to get encryption seed' }, { status: 500 });
    }
}
