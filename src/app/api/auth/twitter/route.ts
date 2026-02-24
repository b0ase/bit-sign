import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Twitter/X OAuth 2.0 with PKCE
 * Uses the new OAuth 2.0 flow (not OAuth 1.0a)
 */
export async function GET(request: NextRequest) {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'Twitter Client ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`;
    const scopes = ['tweet.read', 'users.read'].join(' ');

    // PKCE: generate code_verifier and code_challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    // Store code_verifier in state (base64-encoded JSON with returnTo)
    const statePayload = JSON.stringify({ returnTo, cv: codeVerifier });
    const state = Buffer.from(statePayload).toString('base64url');

    const twitterUrl = new URL('https://twitter.com/i/oauth2/authorize');
    twitterUrl.searchParams.set('response_type', 'code');
    twitterUrl.searchParams.set('client_id', clientId);
    twitterUrl.searchParams.set('redirect_uri', redirectUri);
    twitterUrl.searchParams.set('scope', scopes);
    twitterUrl.searchParams.set('state', state);
    twitterUrl.searchParams.set('code_challenge', codeChallenge);
    twitterUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(twitterUrl.toString());
}
