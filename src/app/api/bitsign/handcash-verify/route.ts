import { NextRequest, NextResponse } from 'next/server';
import { getUserAccount } from '@/lib/handcash';

const SIGNING_FEE_USD = 0.01;
const BITSIGN_HANDLE = process.env.BITSIGN_HANDLE || 'bitsign';

/**
 * POST /api/bitsign/handcash-verify
 * Verifies the user's HandCash identity by signing a message server-side.
 * When envelope_id is provided, also charges $0.01 signing fee from signer's wallet.
 * Uses the httpOnly handcash_auth_token cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const { message, envelope_id } = await request.json();

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

    // If signing an envelope, charge $0.01 signing fee
    let paymentTxid: string | null = null;
    if (envelope_id) {
      try {
        const paymentResult = await userAccount.wallet.pay({
          description: `Bit-Sign: Signature attestation fee`,
          payments: [{
            destination: BITSIGN_HANDLE,
            currencyCode: 'USD',
            sendAmount: SIGNING_FEE_USD,
          }],
        });
        paymentTxid = paymentResult.transactionId;
        console.log(`[handcash-verify] Signing fee paid: ${paymentTxid} by ${publicProfile.handle}`);
      } catch (payError: any) {
        console.error('[handcash-verify] Payment failed:', payError);
        return NextResponse.json(
          { error: 'Payment failed. Please ensure your HandCash wallet has sufficient funds.' },
          { status: 402 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      walletAddress: publicProfile.handle,
      displayName: publicProfile.displayName || publicProfile.handle,
      signature: signResult.signature,
      publicKey: signResult.publicKey,
      paymentTxid,
    });
  } catch (error: any) {
    console.error('[handcash-verify] Error:', error);
    return NextResponse.json(
      { error: error.message || 'HandCash verification failed' },
      { status: 500 }
    );
  }
}
