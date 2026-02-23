import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';
import { mapHandCashUser } from '@/lib/supabase';
import { getCookieDomain } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const authToken = request.nextUrl.searchParams.get('authToken');

    if (!authToken || !handCashConnect) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=no_token`);
    }

    try {
        const account = handCashConnect.getAccountFromAuthToken(authToken);
        const { publicProfile } = await account.profile.getCurrentProfile();

        // Persist user in Supabase with Encrypted Auth Token
        try {
            await mapHandCashUser({
                handle: publicProfile.handle,
                displayName: publicProfile.displayName,
                avatarUrl: publicProfile.avatarUrl,
            }, authToken);
            console.log(`[HandCash/Auth] User ${publicProfile.handle} persisted in Supabase with sovereign token`);
        } catch (dbError) {
            console.error(`[HandCash/Auth] Database persistence failed for ${publicProfile.handle}:`, dbError);
        }

        const returnTo = request.cookies.get('auth_return_to')?.value || '/user/account';
        const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${returnTo}`);
        const domain = getCookieDomain();

        // Set the auth token in an HTTP-only cookie
        response.cookies.set('handcash_auth_token', authToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
            ...(domain && { domain }),
        });

        // Set the handle in a public cookie for the UI
        response.cookies.set('handcash_handle', publicProfile.handle, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
            ...(domain && { domain }),
        });

        // Clear the returnTo cookie
        response.cookies.delete('auth_return_to');

        return response;
    } catch (error) {
        console.error('HandCash Auth Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`);
    }
}
