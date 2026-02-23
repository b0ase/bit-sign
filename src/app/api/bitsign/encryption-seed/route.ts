import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Returns a persistent encryption key for client-side encryption.
 * The key is generated once per user and stored in the database,
 * so it survives HandCash re-authentication (unlike session-derived keys).
 */
export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('handcash_auth_token')?.value;
        const handleCookie = request.cookies.get('handcash_handle')?.value;

        if (!handleCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user already has a stored encryption key
        const { data: identity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('encryption_key')
            .eq('user_handle', handleCookie)
            .maybeSingle();

        // Return existing key (doesn't require auth token — user already proved identity)
        if (identity?.encryption_key) {
            return NextResponse.json({
                success: true,
                encryptionSeed: identity.encryption_key,
            });
        }

        // Creating a new key requires auth token
        if (!authToken) {
            return NextResponse.json({ error: 'Authentication required to initialize encryption' }, { status: 401 });
        }

        // Generate a permanent encryption key (64 hex chars = 256 bits)
        const keyBytes = new Uint8Array(32);
        crypto.getRandomValues(keyBytes);
        const encryptionKey = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // Store it — upsert in case identity row exists without key
        if (identity) {
            await supabaseAdmin
                .from('bit_sign_identities')
                .update({ encryption_key: encryptionKey })
                .eq('user_handle', handleCookie);
        } else {
            // Create identity row with key (user hasn't minted yet)
            await supabaseAdmin
                .from('bit_sign_identities')
                .insert({
                    user_handle: handleCookie,
                    encryption_key: encryptionKey,
                    metadata: {},
                });
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
