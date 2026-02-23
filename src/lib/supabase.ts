import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables for Supabase. Database features may be limited.');
}

// Client for browser-side usage (public)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);

// Admin client for server-side usage (privileged)
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseServiceKey || supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

import { encrypt } from '@/lib/encryption';

/**
 * Maps a HandCash handle to a persistent unified user record
 */
export async function mapHandCashUser(profile: { handle: string, displayName?: string, avatarUrl?: string }, authToken?: string) {
    // 1. Check if HandCash identity already exists
    const { data: identity, error: identityError } = await supabaseAdmin
        .from('user_identities')
        .select('unified_user_id')
        .eq('provider', 'handcash')
        .eq('provider_user_id', profile.handle)
        .maybeSingle();

    if (identityError) {
        console.error('[Supabase] Error checking HandCash identity:', identityError);
        throw identityError;
    }

    if (identity) {
        // Identity exists, update the unified user if needed
        const { data: user, error: userError } = await supabaseAdmin
            .from('unified_users')
            .update({
                display_name: profile.displayName || profile.handle,
                avatar_url: profile.avatarUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', identity.unified_user_id)
            .select()
            .single();

        if (userError) {
            console.error('[Supabase] Error updating unified user:', userError);
        }

        // Store encrypted auth token on unified_users if provided
        if (authToken) {
            const encryptedToken = encrypt(authToken);
            await supabaseAdmin
                .from('unified_users')
                .update({ encrypted_auth_token: encryptedToken })
                .eq('id', identity.unified_user_id);
        }

        return user;
    }

    // 2. No identity found, create new unified user
    const { data: newUser, error: createUserError } = await supabaseAdmin
        .from('unified_users')
        .insert({
            display_name: profile.displayName || profile.handle,
            avatar_url: profile.avatarUrl,
        })
        .select()
        .single();

    if (createUserError || !newUser) {
        console.error('[Supabase] Error creating unified user:', createUserError);
        throw createUserError;
    }

    // 3. Link the HandCash identity
    const { error: linkError } = await supabaseAdmin
        .from('user_identities')
        .insert({
            unified_user_id: newUser.id,
            provider: 'handcash',
            provider_user_id: profile.handle,
            provider_handle: `$${profile.handle}`,
        });

    if (linkError) {
        console.error('[Supabase] Error linking HandCash identity:', linkError);
    }

    // Store encrypted auth token on unified_users if provided
    if (authToken) {
        const encryptedToken = encrypt(authToken);
        await supabaseAdmin
            .from('unified_users')
            .update({ encrypted_auth_token: encryptedToken })
            .eq('id', newUser.id);
    }

    return newUser;
}

export default supabase;
