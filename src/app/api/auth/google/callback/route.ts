import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '/user/account';

    if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=no_code`);
    }

    try {
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

        // 1. Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // 2. Fetch Google user info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        const googleId = userData.id;
        const googleEmail = userData.email;

        // 3. Get HandCash handle from cookie
        const cookieStore = await cookies();
        const handle = cookieStore.get('handcash_handle')?.value;

        if (!handle) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=not_authenticated`);
        }

        // 4. Update identity
        await supabaseAdmin
            .from('bit_sign_identities')
            .update({
                google_email: googleEmail,
                google_id: googleId,
                google_metadata: userData,
            })
            .eq('user_handle', handle);

        // 5. Create oauth/google strand
        try {
            const { data: identity } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('id, token_id')
                .eq('user_handle', handle)
                .maybeSingle();

            if (identity) {
                await createStrand({
                    identityId: identity.id,
                    rootTxid: identity.token_id,
                    strandType: 'oauth',
                    strandSubtype: 'google',
                    providerHandle: googleEmail,
                    providerId: googleId,
                    label: `Google ${googleEmail}`,
                    userHandle: handle,
                });
            }
        } catch (strandErr) {
            console.warn('[google-callback] Strand creation failed (non-fatal):', strandErr);
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${state}`);
    } catch (error: any) {
        console.error('Google Auth Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=${encodeURIComponent(error.message)}`);
    }
}
