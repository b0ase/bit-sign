import { NextResponse } from 'next/server';
import { getCookieDomain } from '@/lib/auth';

export async function GET() {
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);
    const domain = getCookieDomain();

    // Clear cookies — must specify same domain they were set with
    response.cookies.set('handcash_auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
        ...(domain && { domain }),
    });
    response.cookies.set('handcash_handle', '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
        ...(domain && { domain }),
    });

    // Also clear any old host-only cookies (without domain)
    response.cookies.delete('handcash_auth_token');
    response.cookies.delete('handcash_handle');

    return response;
}
