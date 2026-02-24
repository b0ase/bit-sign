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
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`;
        const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

        // 1. Exchange code for access token
        const tokenResponse = await fetch(
            `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    client_id: process.env.MICROSOFT_CLIENT_ID!,
                    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
                    redirect_uri: redirectUri,
                }),
            }
        );

        const tokenData = await tokenResponse.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // 2. Fetch Microsoft user data from Graph API
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        const microsoftId = userData.id;
        const microsoftEmail = userData.mail || userData.userPrincipalName;

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
                microsoft_email: microsoftEmail,
                microsoft_id: microsoftId,
                microsoft_metadata: userData,
            })
            .eq('user_handle', handle);

        // 5. Create oauth/microsoft strand
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
                    strandSubtype: 'microsoft',
                    providerHandle: microsoftEmail,
                    providerId: microsoftId,
                    label: `Microsoft ${microsoftEmail}`,
                    userHandle: handle,
                });
            }
        } catch (strandErr) {
            console.warn('[microsoft-callback] Strand creation failed (non-fatal):', strandErr);
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${state}`);
    } catch (error: any) {
        console.error('Microsoft Auth Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/user/account?error=${encodeURIComponent(error.message)}`);
    }
}
