import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';

export async function GET(request: NextRequest) {
    if (!handCashConnect) {
        return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/';

    // Request essential sovereign scopes for Bit-Sign
    const redirectUrl = handCashConnect.getRedirectionUrl();
    // Note: The HandCashConnect SDK uses the dashboard configuration by default,
    // but we ensure the app is requesting the right context.

    // For now, we just redirect. In a real app, you'd store returnTo in state.
    return NextResponse.redirect(redirectUrl);
}
