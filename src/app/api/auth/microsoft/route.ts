import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'Microsoft Client ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`;
    const scopes = ['openid', 'profile', 'email', 'User.Read'].join(' ');
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

    const msUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
    msUrl.searchParams.set('client_id', clientId);
    msUrl.searchParams.set('response_type', 'code');
    msUrl.searchParams.set('redirect_uri', redirectUri);
    msUrl.searchParams.set('scope', scopes);
    msUrl.searchParams.set('state', returnTo);
    msUrl.searchParams.set('response_mode', 'query');
    msUrl.searchParams.set('prompt', 'select_account');

    return NextResponse.redirect(msUrl.toString());
}
