import { NextRequest, NextResponse } from 'next/server';
import { getUserAccount } from '@/lib/handcash';
import { SEED_PHRASE } from '@/lib/attestation';

/**
 * Returns a cryptographically signed seed for client-side encryption.
 * This seed is unique to the user but consistent across sessions.
 */
export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('handcash_auth_token')?.value;

        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userAccount = getUserAccount(authToken);
        if (!userAccount) {
            return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
        }

        // We sign a fixed string to get a repeatable, user-specific seed for encryption
        const signature = await userAccount.profile.signData({
            value: SEED_PHRASE,
            format: 'utf-8'
        });

        return NextResponse.json({
            success: true,
            encryptionSeed: signature.signature,
            publicKey: signature.publicKey
        });
    } catch (error: any) {
        console.error('Encryption Seed Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to get encryption seed' }, { status: 500 });
    }
}
