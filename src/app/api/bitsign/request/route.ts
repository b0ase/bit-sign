import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { getHouseAccount } from '@/lib/handcash';

/**
 * POST /api/bitsign/request
 * Sends a test micro-payment ($0.01) from the house account to the user
 * to verify their wallet connection is working.
 */
export async function POST(request: NextRequest) {
    const handle = await resolveUserHandle(request);
    if (!handle) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const houseAccount = getHouseAccount();
        if (!houseAccount) {
            return NextResponse.json({ error: 'House account not configured' }, { status: 500 });
        }

        const result = await houseAccount.wallet.pay({
            description: `Bit-Sign: Test verification ping for $${handle}`,
            appAction: 'test-alert',
            payments: [
                {
                    destination: handle,
                    currencyCode: 'USD',
                    sendAmount: 0.01,
                },
            ],
            attachment: {
                format: 'json',
                value: {
                    type: 'bit-sign-test-alert',
                    handle,
                    timestamp: new Date().toISOString(),
                },
            },
        });

        return NextResponse.json({
            status: 'sent',
            transactionId: result.transactionId,
            message: `Test payment of $0.01 sent to $${handle}`,
        });
    } catch (error: any) {
        console.error('[request] Test alert error:', error);
        return NextResponse.json({ error: error.message || 'Failed to send test alert' }, { status: 500 });
    }
}
