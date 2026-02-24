import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'LinkedIn Client ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;
    const scopes = ['openid', 'profile', 'email'].join(' ');

    const linkedinUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    linkedinUrl.searchParams.set('response_type', 'code');
    linkedinUrl.searchParams.set('client_id', clientId);
    linkedinUrl.searchParams.set('redirect_uri', redirectUri);
    linkedinUrl.searchParams.set('scope', scopes);
    linkedinUrl.searchParams.set('state', returnTo);

    return NextResponse.redirect(linkedinUrl.toString());
}
