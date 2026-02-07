import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';

export async function GET(request: NextRequest) {
    const authToken = request.nextUrl.searchParams.get('authToken');

    if (!authToken || !handCashConnect) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=no_token`);
    }

    try {
        const account = handCashConnect.getAccountFromAuthToken(authToken);
        const { publicProfile } = await account.profile.getCurrentProfile();

        // Create the response
        const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);

        // Set the auth token in an HTTP-only cookie
        response.cookies.set('handcash_auth_token', authToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });

        // Set the handle in a public cookie for the UI
        response.cookies.set('handcash_handle', publicProfile.handle, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('HandCash Auth Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`);
    }
}
