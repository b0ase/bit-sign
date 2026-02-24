import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * GET — Fetch invite info (public, no auth required).
 * Returns sender, item type/label, message — no sensitive data.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const { data: invite, error } = await supabaseAdmin
            .from('vault_share_invites')
            .select('sender_handle, item_type, item_label, message, status, created_at')
            .eq('claim_token', token)
            .single();

        if (error || !invite) {
            return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
        }

        if (invite.status !== 'pending') {
            return NextResponse.json(
                { error: 'This invite has already been claimed', status: invite.status },
                { status: 410 }
            );
        }

        return NextResponse.json({
            senderHandle: invite.sender_handle,
            itemType: invite.item_type,
            itemLabel: invite.item_label,
            message: invite.message,
            createdAt: invite.created_at,
        });
    } catch (error: any) {
        console.error('[claim/GET] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch invite' }, { status: 500 });
    }
}

/**
 * POST — Claim the invite (requires auth).
 * Creates a document_access_grant and marks invite as claimed.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token } = await params;

        // Look up pending invite
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('vault_share_invites')
            .select('id, document_id, sender_handle, status')
            .eq('claim_token', token)
            .single();

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
        }

        if (invite.status !== 'pending') {
            return NextResponse.json(
                { error: 'This invite has already been claimed' },
                { status: 410 }
            );
        }

        if (invite.sender_handle === handle) {
            return NextResponse.json(
                { error: 'You cannot claim your own invite' },
                { status: 400 }
            );
        }

        // Create document access grant (server-accessible, no E2E wrapping)
        const { error: grantError } = await supabaseAdmin
            .from('document_access_grants')
            .insert({
                document_id: invite.document_id,
                document_type: 'vault_item',
                grantor_handle: invite.sender_handle,
                grantee_handle: handle,
                wrapped_key: null,
                ephemeral_public_key: null,
                encryption_version: 0,
            });

        if (grantError) throw grantError;

        // Mark invite as claimed
        const { error: updateError } = await supabaseAdmin
            .from('vault_share_invites')
            .update({
                status: 'claimed',
                claimed_by_handle: handle,
                claimed_at: new Date().toISOString(),
            })
            .eq('id', invite.id);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            redirectTo: '/user/account',
        });
    } catch (error: any) {
        console.error('[claim/POST] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to claim invite' },
            { status: 500 }
        );
    }
}
