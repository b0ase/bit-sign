import { NextRequest } from 'next/server';
import { getUserAccount } from './handcash';

/**
 * Resolves the user's handle from the request.
 * Fast path: direct handle cookie.
 * Fallback: auth token -> HandCash API lookup.
 *
 * Cookie names follow @b0ase/wallet convention:
 *   handcash_handle / b0ase_user_handle (handle)
 *   handcash_auth_token / b0ase_handcash_token (auth token)
 */
export async function resolveUserHandle(request: NextRequest): Promise<string | null> {
    const handleCookie =
        request.cookies.get('handcash_handle')?.value ??
        request.cookies.get('b0ase_user_handle')?.value;
    if (handleCookie) return handleCookie;

    const authToken =
        request.cookies.get('handcash_auth_token')?.value ??
        request.cookies.get('b0ase_handcash_token')?.value;
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
    return '.bit-sign.online';
}
