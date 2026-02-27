import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';
import { mapHandCashUser, supabaseAdmin } from '@/lib/supabase';
import { getCookieDomain } from '@/lib/auth';
import { linkExistingVaultItems } from '@/lib/identity-strands';

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

        // Sync avatar to bit_sign_identities if empty
        if (publicProfile.avatarUrl) {
            try {
                const { data: identity } = await supabaseAdmin
                    .from('bit_sign_identities')
                    .select('id, avatar_url')
                    .eq('user_handle', publicProfile.handle)
                    .maybeSingle();
                if (identity && !identity.avatar_url) {
                    await supabaseAdmin
                        .from('bit_sign_identities')
                        .update({ avatar_url: publicProfile.avatarUrl })
                        .eq('id', identity.id);
                    console.log(`[HandCash/Auth] Synced avatar for ${publicProfile.handle}`);
                }
            } catch (avatarErr) {
                // Non-fatal
            }
        }

        // Auto-mint identity if no bit_sign_identities row exists
        try {
            const { data: existingIdentity } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('id, token_id')
                .eq('user_handle', publicProfile.handle)
                .maybeSingle();

            if (!existingIdentity) {
                console.log(`[HandCash/Auth] No identity for ${publicProfile.handle}, auto-minting...`);
                let tokenId = 'pending';
                try {
                    const rootData = {
                        p: '401',
                        op: 'root',
                        v: '1.0',
                        handle: publicProfile.handle,
                        symbol: `$${publicProfile.handle.toUpperCase()}`,
                        payloadHash: `identity-root-${publicProfile.handle}-${Date.now()}`,
                        ts: new Date().toISOString(),
                    };
                    const paymentResult = await account.wallet.pay({
                        description: `BitSign: Mint identity $${publicProfile.handle.toUpperCase()}`,
                        appAction: 'identity-root',
                        payments: [
                            { destination: publicProfile.handle, currencyCode: 'BSV', sendAmount: 0.00001 },
                        ],
                        attachment: { format: 'json', value: rootData },
                    });
                    tokenId = paymentResult.transactionId;
                    console.log(`[HandCash/Auth] Identity inscribed via HandCash: ${tokenId}`);
                } catch (inscribeErr: any) {
                    console.error(`[HandCash/Auth] Inscription failed for ${publicProfile.handle}, using pending:`, inscribeErr?.message || inscribeErr);
                }

                const { data: newIdentity } = await supabaseAdmin
                    .from('bit_sign_identities')
                    .insert({
                        user_handle: publicProfile.handle,
                        token_id: tokenId,
                        metadata: { symbol: `$${publicProfile.handle.toUpperCase()}`, type: 'Identity Root' },
                        avatar_url: publicProfile.avatarUrl || null,
                        identity_strength: 1,
                    })
                    .select('id')
                    .single();

                if (newIdentity && tokenId !== 'pending') {
                    try {
                        await linkExistingVaultItems(newIdentity.id, tokenId, publicProfile.handle);
                        console.log(`[HandCash/Auth] Linked existing vault items for ${publicProfile.handle}`);
                    } catch (linkErr) {
                        console.error(`[HandCash/Auth] linkExistingVaultItems failed:`, linkErr);
                    }
                }
                console.log(`[HandCash/Auth] Identity auto-minted for ${publicProfile.handle}`);
            }
        } catch (mintErr) {
            console.error(`[HandCash/Auth] Auto-mint failed for ${publicProfile.handle}:`, mintErr);
            // Non-fatal — user can still access account, just won't have identity yet
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
