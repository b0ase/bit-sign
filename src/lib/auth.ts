import { NextRequest } from 'next/server';
import { getUserAccount } from './handcash';

/**
 * Resolves the user's handle from the request.
 * Tries handcash_handle cookie first, then falls back to
 * looking up the profile via handcash_auth_token.
 */
export async function resolveUserHandle(request: NextRequest): Promise<string | null> {
    // 1. Try the handle cookie (fast path)
    const handleCookie = request.cookies.get('handcash_handle')?.value;
    if (handleCookie) return handleCookie;

    // 2. Fall back to auth token → HandCash API lookup
    const authToken = request.cookies.get('handcash_auth_token')?.value;
    if (!authToken) return null;

    try {
        const account = getUserAccount(authToken);
        if (!account) return null;
        const { publicProfile } = await account.profile.getCurrentProfile();
        return publicProfile?.handle || null;
    } catch (e) {
        console.error('[resolveUserHandle] HandCash lookup failed:', e);
        return null;
    }
}

/**
 * Cookie domain for production — ensures cookies work on both
 * bit-sign.online and www.bit-sign.online
 */
export function getCookieDomain(): string | undefined {
    if (process.env.NODE_ENV !== 'production') return undefined;
    // Leading dot = send to all subdomains
    return '.bit-sign.online';
}
