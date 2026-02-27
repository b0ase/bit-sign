import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';
import { sendVaultShareInvitation } from '@/lib/email';
import crypto from 'crypto';

const ITEM_LABELS: Record<string, string> = {
    VIDEO: 'Video Message',
    CAMERA: 'Camera Proof',
    DOCUMENT: 'Document',
    TLDRAW: 'Drawing',
    SEALED_DOCUMENT: 'Sealed Document',
    IDENTITY_MINT: 'Identity Mint',
};

export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { documentId, recipientEmail, message, ccEmail } = await request.json();

        if (!documentId || !recipientEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        // Verify document belongs to user
        const { data: sig, error: sigError } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, metadata')
            .eq('id', documentId)
            .single();

        if (sigError || !sig) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        if (sig.user_handle !== handle) {
            return NextResponse.json({ error: 'Document not owned by you' }, { status: 403 });
        }

        // If sharing an unsealed document, auto-upgrade to the most recent sealed version
        // so the recipient sees the sender's signature
        let finalDocumentId = documentId;
        if (sig.signature_type === 'DOCUMENT') {
            const { data: sealedVersion } = await supabaseAdmin
                .from('bit_sign_signatures')
                .select('id, signature_type, metadata')
                .eq('user_handle', handle)
                .eq('signature_type', 'SEALED_DOCUMENT')
                .filter('metadata->>originalDocumentId', 'eq', documentId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (sealedVersion) {
                finalDocumentId = sealedVersion.id;
                // Update sig reference for metadata below
                sig.signature_type = sealedVersion.signature_type;
                sig.metadata = sealedVersion.metadata;
            }
        }

        // Determine item type and label
        const itemType = sig.signature_type || 'DOCUMENT';
        const itemLabel = sig.metadata?.type || ITEM_LABELS[itemType] || itemType;

        // Generate claim token
        const claimToken = crypto.randomUUID();

        // Insert invite
        const { data: invite, error: insertError } = await supabaseAdmin
            .from('vault_share_invites')
            .insert({
                sender_handle: handle,
                document_id: finalDocumentId,
                recipient_email: recipientEmail,
                claim_token: claimToken,
                message: message || null,
                item_type: itemType,
                item_label: itemLabel,
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        // Build claim URL and send email
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online';
        const claimUrl = `${appUrl}/claim/${claimToken}`;

        const emailResult = await sendVaultShareInvitation({
            recipientEmail,
            senderHandle: handle,
            itemType,
            itemLabel,
            claimUrl,
            message: message || undefined,
        });

        if (!emailResult.success) {
            console.error('[invite] Email send failed:', emailResult.error);
            // Invite is created even if email fails — return warning with detail
            return NextResponse.json({
                success: true,
                inviteId: invite.id,
                warning: `Invite created but email delivery failed: ${emailResult.error}`,
            });
        }

        // Send CC copy if requested
        let ccSent = false;
        if (ccEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ccEmail) && ccEmail !== recipientEmail) {
            try {
                const ccResult = await sendVaultShareInvitation({
                    recipientEmail: ccEmail,
                    senderHandle: handle,
                    itemType,
                    itemLabel,
                    claimUrl,
                    message: `[Copy] Sent to ${recipientEmail}${message ? ` — ${message}` : ''}`,
                });
                ccSent = ccResult.success;
            } catch (ccErr) {
                console.warn('[invite] CC email failed (non-fatal):', ccErr);
            }
        }

        return NextResponse.json({ success: true, inviteId: invite.id, ccSent });
    } catch (error: any) {
        console.error('[invite] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create invite' },
            { status: 500 }
        );
    }
}
