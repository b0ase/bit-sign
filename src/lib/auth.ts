import { NextRequest } from 'next/server';
import { resolveUserHandle as _resolve } from '@b0ase/wallet/auth';
import { getUserAccount } from './handcash';

/**
 * Resolves the user's handle from the request.
 * Uses @b0ase/wallet's cookie resolution with HandCash API fallback.
 */
export async function resolveUserHandle(request: NextRequest): Promise<string | null> {
    return _resolve(request, async (authToken) => {
        const account = getUserAccount(authToken);
        if (!account) return null;
        const { publicProfile } = await account.profile.getCurrentProfile();
        return publicProfile?.handle || null;
    });
}

/**
 * Cookie domain for production — ensures cookies work on both
 * bit-sign.online and www.bit-sign.online
 */
export function getCookieDomain(): string | undefined {
    if (process.env.NODE_ENV !== 'production') return undefined;
    return '.bit-sign.online';
}
