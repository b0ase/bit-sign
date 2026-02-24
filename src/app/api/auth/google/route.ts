import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'Google Client ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
    const scopes = ['openid', 'email', 'profile'].join(' ');

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleUrl.searchParams.set('client_id', clientId);
    googleUrl.searchParams.set('redirect_uri', redirectUri);
    googleUrl.searchParams.set('response_type', 'code');
    googleUrl.searchParams.set('scope', scopes);
    googleUrl.searchParams.set('state', returnTo);
    googleUrl.searchParams.set('access_type', 'online');
    googleUrl.searchParams.set('prompt', 'select_account');

    return NextResponse.redirect(googleUrl.toString());
}
