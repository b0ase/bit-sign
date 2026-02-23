import { NextResponse } from 'next/server';

export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online';
    const response = NextResponse.redirect(appUrl);

    // Clear domain-scoped cookies (new format)
    const domainOpts = {
        path: '/',
        maxAge: 0,
        domain: '.bit-sign.online',
    } as const;

    response.headers.append('Set-Cookie', `handcash_auth_token=; Path=/; Max-Age=0; Domain=.bit-sign.online; HttpOnly; Secure; SameSite=Lax`);
    response.headers.append('Set-Cookie', `handcash_handle=; Path=/; Max-Age=0; Domain=.bit-sign.online; Secure; SameSite=Lax`);

    // Also clear old host-only cookies (no domain — browser matches exact host)
    response.headers.append('Set-Cookie', `handcash_auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    response.headers.append('Set-Cookie', `handcash_handle=; Path=/; Max-Age=0; Secure; SameSite=Lax`);

    return response;
}
