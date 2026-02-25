import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/peer-attest
 * Request a peer attestation OR respond to one.
 *
 * To REQUEST: { action: 'request', peerHandle, message? }
 * To RESPOND: { action: 'respond', requestId, declaration }
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;

        if (action === 'request') {
            return handleRequest(handle, body);
        } else if (action === 'respond') {
            return handleRespond(handle, body);
        } else {
            return NextResponse.json({ error: 'Invalid action. Must be "request" or "respond".' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[peer-attest] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}

/**
 * GET /api/bitsign/peer-attest
 * List peer attestation requests where current user is the attestor (peer).
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: requests, error } = await supabaseAdmin
            .from('peer_attestation_requests')
            .select('*')
            .eq('attestor_handle', handle)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ requests: requests || [] });
    } catch (error: any) {
        console.error('[peer-attest] GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}

// --- Request: User asks a peer to attest their identity ---
async function handleRequest(handle: string, body: any) {
    const { peerHandle, message } = body;

    const cleanPeer = peerHandle?.replace(/^\$/, '').trim();
    if (!cleanPeer) {
        return NextResponse.json({ error: 'peerHandle is required' }, { status: 400 });
    }
    if (cleanPeer === handle) {
        return NextResponse.json({ error: 'Cannot request attestation from yourself' }, { status: 400 });
    }

    // Check if there's already a pending request to this peer
    const { data: existing } = await supabaseAdmin
        .from('peer_attestation_requests')
        .select('id')
        .eq('requester_handle', handle)
        .eq('attestor_handle', cleanPeer)
        .eq('status', 'pending')
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'You already have a pending attestation request to this peer.' }, { status: 400 });
    }

    const { data: req, error } = await supabaseAdmin
        .from('peer_attestation_requests')
        .insert({
            requester_handle: handle,
            attestor_handle: cleanPeer,
            message: message || null,
            status: 'pending',
        })
        .select()
        .single();

    if (error) throw error;

    console.log(`[peer-attest] ${handle} requested attestation from ${cleanPeer}: ${req.id}`);

    return NextResponse.json({ success: true, requestId: req.id });
}

// --- Respond: Peer signs the pro-forma declaration ---
async function handleRespond(attestorHandle: string, body: any) {
    const { requestId, declaration } = body;

    if (!requestId || !declaration) {
        return NextResponse.json({ error: 'requestId and declaration are required' }, { status: 400 });
    }

    // Fetch the request
    const { data: req } = await supabaseAdmin
        .from('peer_attestation_requests')
        .select('*')
        .eq('id', requestId)
        .eq('attestor_handle', attestorHandle)
        .eq('status', 'pending')
        .maybeSingle();

    if (!req) {
        return NextResponse.json({ error: 'Request not found or already responded' }, { status: 404 });
    }

    // Update the request status
    await supabaseAdmin
        .from('peer_attestation_requests')
        .update({
            status: 'attested',
            declaration,
            attested_at: new Date().toISOString(),
        })
        .eq('id', requestId);

    // Create a peer_attestation/cosign strand for the requester
    const { data: requesterIdentity } = await supabaseAdmin
        .from('bit_sign_identities')
        .select('id, token_id')
        .eq('user_handle', req.requester_handle)
        .maybeSingle();

    if (requesterIdentity) {
        try {
            await createStrand({
                identityId: requesterIdentity.id,
                rootTxid: requesterIdentity.token_id,
                strandType: 'peer_attestation',
                strandSubtype: 'cosign',
                providerHandle: attestorHandle,
                label: `Peer attestation by ${attestorHandle}`,
                metadata: {
                    attestorHandle,
                    declaration,
                    attestedAt: new Date().toISOString(),
                },
                userHandle: req.requester_handle,
            });
            console.log(`[peer-attest] Created peer_attestation/cosign strand for ${req.requester_handle} by ${attestorHandle}`);
        } catch (strandErr) {
            console.warn('[peer-attest] Strand creation failed (non-fatal):', strandErr);
        }
    }

    return NextResponse.json({ success: true });
}
