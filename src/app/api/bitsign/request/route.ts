import { NextRequest, NextResponse } from 'next/server';
import { handCashConnect } from '@/lib/handcash';

/**
 * API for external apps to request a signature from a user.
 * This triggers a HandCash Pay request to the user's handle.
 */
export async function POST(request: NextRequest) {
    if (!handCashConnect) {
        return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { handle, message, callbackUrl, fee = 0.01 } = body;

        if (!handle || !message) {
            return NextResponse.json({ error: 'Handle and message are required' }, { status: 400 });
        }

        const houseAccount = handCashConnect.getAccountFromAuthToken(process.env.HOUSE_AUTH_TOKEN!);

        // Using raw service to create payment request as it's missing from the type definitions
        const service = (houseAccount as any).handCashConnectService;
        const requestParameters = {
            description: `Bit-Sign: ${message.slice(0, 50)}...`,
            payments: [
                {
                    destination: '$bitsign', // Bit-Sign Treasury
                    currencyCode: 'USD',
                    sendAmount: fee,
                }
            ],
            expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
            customData: {
                message,
                callbackUrl,
                source: 'Bit-Sign SaaS'
            }
        };

        const httpRequest = service.getRequest('POST', '/v1/connect/wallet/paymentRequest', requestParameters);
        const response = await fetch(httpRequest.url, httpRequest);
        const paymentData = await response.json();

        if (!response.ok) {
            throw new Error(paymentData.message || 'Failed to create payment request');
        }

        // The paymentUrl is what the user opens to sign/pay
        console.log(`🚀 Signature Request created for ${handle}: ${paymentData.paymentUrl}`);

        return NextResponse.json({
            status: 'requested',
            paymentUrl: paymentData.paymentUrl,
            paymentId: paymentData.paymentId,
            qrCodeUrl: paymentData.qrCodeUrl
        });

    } catch (error: any) {
        console.error('Bit-Sign Request Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
