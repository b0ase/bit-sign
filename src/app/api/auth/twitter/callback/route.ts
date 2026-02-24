import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (!code || !stateParam) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=no_code`);
    }

    try {
        // Decode state to get returnTo and code_verifier
        const statePayload = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
        const returnTo = statePayload.returnTo || '/user/account';
        const codeVerifier = statePayload.cv;

        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`;

        // 1. Exchange code for access token (Basic auth with client_id:client_secret)
        const credentials = Buffer.from(
            `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64');

        const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // 2. Fetch Twitter user data
        const userResponse = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,username', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userResult = await userResponse.json();
        const userData = userResult.data;

        const twitterId = userData.id;
        const twitterHandle = userData.username;

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
                twitter_handle: twitterHandle,
                twitter_id: twitterId,
                twitter_metadata: userData,
            })
            .eq('user_handle', handle);

        // 5. Create oauth/twitter strand
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
                    strandSubtype: 'twitter',
                    providerHandle: twitterHandle,
                    providerId: twitterId,
                    label: `X @${twitterHandle}`,
                    userHandle: handle,
                });
            }
        } catch (strandErr) {
            console.warn('[twitter-callback] Strand creation failed (non-fatal):', strandErr);
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${returnTo}`);
    } catch (error: any) {
        console.error('Twitter Auth Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=${encodeURIComponent(error.message)}`);
    }
}
