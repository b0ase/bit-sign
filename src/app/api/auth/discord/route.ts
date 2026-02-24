import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'Discord Client ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/discord/callback`;
    const scopes = ['identify', 'email'].join(' ');

    const discordUrl = new URL('https://discord.com/oauth2/authorize');
    discordUrl.searchParams.set('response_type', 'code');
    discordUrl.searchParams.set('client_id', clientId);
    discordUrl.searchParams.set('redirect_uri', redirectUri);
    discordUrl.searchParams.set('scope', scopes);
    discordUrl.searchParams.set('state', returnTo);
    discordUrl.searchParams.set('prompt', 'consent');

    return NextResponse.redirect(discordUrl.toString());
}
