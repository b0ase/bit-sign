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
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;

        // 1. Exchange code for access token
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: process.env.LINKEDIN_CLIENT_ID!,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // 2. Fetch LinkedIn user info via OpenID Connect userinfo endpoint
        const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        const linkedinId = userData.sub;
        const linkedinName = userData.name;

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
                linkedin_name: linkedinName,
                linkedin_id: linkedinId,
                linkedin_metadata: userData,
            })
            .eq('user_handle', handle);

        // 5. Create oauth/linkedin strand
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
                    strandSubtype: 'linkedin',
                    providerHandle: linkedinName,
                    providerId: linkedinId,
                    label: `LinkedIn ${linkedinName}`,
                    userHandle: handle,
                });
            }
        } catch (strandErr) {
            console.warn('[linkedin-callback] Strand creation failed (non-fatal):', strandErr);
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${state}`);
    } catch (error: any) {
        console.error('LinkedIn Auth Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=${encodeURIComponent(error.message)}`);
    }
}
