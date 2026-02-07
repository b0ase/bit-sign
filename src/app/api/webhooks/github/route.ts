
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { handCashConnect } from '@/lib/handcash';

export async function POST(request: NextRequest) {
    if (!handCashConnect) {
        return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
    }

    try {
        const payload = await request.text();
        const signature = request.headers.get('x-hub-signature-256');
        const event = request.headers.get('x-github-event');

        // 1. Verify Webhook Signature (Security)
        // Note: In production, you must set GITHUB_WEBHOOK_SECRET
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        if (secret && signature) {
            const hmac = crypto.createHmac('sha256', secret);
            const digest = 'sha256=' + hmac.update(payload).digest('hex');
            if (signature !== digest) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        // 2. Parse Event
        const body = JSON.parse(payload);

        if (event === 'push') {
            const { ref, commits, repository, pusher } = body;
            const branch = ref.split('/').pop();
            const latestCommit = commits[commits.length - 1];

            console.log(`Received push event: ${repository.full_name} on ${branch} by ${pusher.name}`);

            // 3. Find Bit-Sign Identity linked to this GitHub user
            // We search by github_handle (from pusher.name or matching commit author username)
            const { data: identity, error: idError } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('*')
                .eq('github_handle', pusher.name) // or pusher.username depending on payload
                .maybeSingle();

            if (!identity || idError) {
                console.log(`No linked Bit-Sign identity found for GitHub user: ${pusher.name}`);
                return NextResponse.json({ message: 'No linked identity' });
            }

            // 4. Trigger HandCash Signature Request
            const houseAccount = handCashConnect.getAccountFromAuthToken(process.env.HOUSE_AUTH_TOKEN!);
            const service = (houseAccount as any).handCashConnectService;

            const message = `Verify Commit: ${latestCommit.message.slice(0, 40)}... (${repository.name})`;

            const requestParameters = {
                description: "Bit-Sign: GitHub Commit Verification",
                payments: [
                    {
                        destination: '$bitsign',
                        currencyCode: 'USD',
                        sendAmount: 0.01,
                    }
                ],
                expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour expiry
                customData: {
                    type: 'GITHUB_COMMIT',
                    repo: repository.full_name,
                    commit: latestCommit.id,
                    message: latestCommit.message,
                    branch
                }
            };

            const httpRequest = service.getRequest('POST', '/v1/connect/wallet/paymentRequest', requestParameters);
            const response = await fetch(httpRequest.url, httpRequest);
            const paymentData = await response.json();

            if (response.ok) {
                console.log(`🚀 Triggered Signature Request for ${identity.user_handle}: ${paymentData.paymentUrl}`);
                return NextResponse.json({ success: true, paymentId: paymentData.paymentId });
            } else {
                throw new Error(paymentData.message);
            }
        }

        return NextResponse.json({ message: 'Event ignored' });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
