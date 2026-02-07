import { NextRequest, NextResponse } from 'next/server';
import { getUserAccount } from '@/lib/handcash';

/**
 * Signs an identity manifest using the user's HandCash account.
 * This provides cryptographic proof that the data was verified by the user's wallet.
 */
export async function POST(request: NextRequest) {
    try {
        const { manifest } = await request.json();
        const authToken = request.cookies.get('handcash_auth_token')?.value;

        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userAccount = getUserAccount(authToken);
        if (!userAccount) {
            return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
        }

        // We use data signing to create a verifiable signature of the JSON manifest
        // This requires the 'SIGN_DATA' scope in HandCash
        const manifestString = JSON.stringify(manifest);
        const signature = await userAccount.profile.signData({
            value: manifestString,
            format: 'utf-8'
        });

        return NextResponse.json({
            success: true,
            signature: signature.signature,
            publicKey: signature.publicKey,
            manifest: manifestString
        });
    } catch (error: any) {
        console.error('Manifest Signing Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to sign manifest' }, { status: 500 });
    }
}
