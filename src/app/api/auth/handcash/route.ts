import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';

export async function GET(request: NextRequest) {
    if (!handCashConnect) {
        return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/';

    // Store returnTo in a cookie or just use it in the redirect
    const redirectUrl = handCashConnect.getRedirectionUrl();

    // For now, we just redirect. In a real app, you'd store returnTo in state.
    return NextResponse.redirect(redirectUrl);
}
