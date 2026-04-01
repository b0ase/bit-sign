import { NextRequest } from 'next/server';
import { getUserAccount } from './handcash';

/**
 * Validates a device token from the Authorization header.
 * Used by ClawMiner devices for programmatic access to signing APIs.
 * Returns the device handle if valid, null otherwise.
 */
export function validateDeviceToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const expectedToken = process.env.CLAW_DEVICE_TOKEN;
    if (!expectedToken || !token) return null;

    // Constant-time comparison
    if (token.length !== expectedToken.length) return null;
    let mismatch = 0;
    for (let i = 0; i < token.length; i++) {
        mismatch |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    return process.env.CLAW_DEVICE_HANDLE || 'bailey.claw.1';
}

/**
 * Resolves the user's handle from the request.
 * Fast path: direct handle cookie.
 * Fallback: auth token -> HandCash API lookup.
 * Final fallback: device bearer token (ClawMiner).
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
    if (authToken) {
        try {
            const account = getUserAccount(authToken);
            if (!account) return null;
            const { publicProfile } = await account.profile.getCurrentProfile();
            if (publicProfile?.handle) return publicProfile.handle;
        } catch (e) {
            console.error('[resolveUserHandle] HandCash lookup failed:', e);
        }
    }

    // Device token fallback (ClawMiner agents)
    return validateDeviceToken(request);
}

/**
 * Cookie domain for production — ensures cookies work on both
 * bit-sign.online and www.bit-sign.online
 */
export function getCookieDomain(): string | undefined {
    if (process.env.NODE_ENV !== 'production') return undefined;
    return '.bit-sign.online';
}
