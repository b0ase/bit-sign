import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';

export async function GET(request: NextRequest) {
    if (!handCashConnect) {
        return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    const redirectUrl = handCashConnect.getRedirectionUrl();

    const response = NextResponse.redirect(redirectUrl);

    // Store returnTo in a cookie so the callback knows where to send the user
    response.cookies.set('auth_return_to', returnTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 5, // 5 minutes — just for the OAuth round-trip
        path: '/',
    });

    return response;
}
