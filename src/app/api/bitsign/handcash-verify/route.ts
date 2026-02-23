import { NextRequest, NextResponse } from 'next/server';
import { getUserAccount } from '@/lib/handcash';

/**
 * POST /api/bitsign/handcash-verify
 * Verifies the user's HandCash identity by signing a message server-side.
 * Uses the httpOnly handcash_auth_token cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message to sign' }, { status: 400 });
    }

    const authToken = request.cookies.get('handcash_auth_token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated with HandCash', needsAuth: true },
        { status: 401 }
      );
    }

    const userAccount = getUserAccount(authToken);
    if (!userAccount) {
      return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
    }

    // Get the user's profile for wallet address / display name
    const { publicProfile } = await userAccount.profile.getCurrentProfile();

    // Sign the message with HandCash
    const signResult = await userAccount.profile.signData({
      value: message,
      format: 'utf-8',
    });

    return NextResponse.json({
      success: true,
      walletAddress: publicProfile.handle,
      displayName: publicProfile.displayName || publicProfile.handle,
      signature: signResult.signature,
      publicKey: signResult.publicKey,
    });
  } catch (error: any) {
    console.error('[handcash-verify] Error:', error);
    return NextResponse.json(
      { error: error.message || 'HandCash verification failed' },
      { status: 500 }
    );
  }
}
