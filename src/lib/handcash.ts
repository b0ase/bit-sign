import { HandCashConnect } from '@handcash/handcash-connect';

const appId = process.env.HANDCASH_APP_ID;
const appSecret = process.env.HANDCASH_APP_SECRET;

// Demo mode detection
const isDemoMode = !appId || !appSecret;

if (isDemoMode) {
    console.log('🔧 HandCash: Running in DEMO MODE (no credentials configured)');
} else {
    console.log('🔧 HandCash Init Debug:', {
        appId: appId ? `${appId.slice(0, 4)}...` : 'MISSING',
        hasSecret: !!appSecret
    });
}

// Create HandCashConnect instance only if credentials are available
// In demo mode, we use a dummy instance that will be null-checked by consumers
export const handCashConnect = isDemoMode
    ? null
    : new HandCashConnect({
        appId: appId!,
        appSecret: appSecret!,
      });

/**
 * Returns the "House" account instance using the HOUSE_AUTH_TOKEN.
 * This account is used for platform operations, minting, and payouts.
 */
export function getHouseAccount() {
    if (!handCashConnect) {
        console.warn('⚠️ HandCash is in DEMO MODE - no real account available');
        return null;
    }
    const houseAuthToken = process.env.HOUSE_AUTH_TOKEN;
    if (!houseAuthToken) {
        console.warn('⚠️ HOUSE_AUTH_TOKEN is not configured in .env');
        return null;
    }
    return handCashConnect.getAccountFromAuthToken(houseAuthToken);
}
