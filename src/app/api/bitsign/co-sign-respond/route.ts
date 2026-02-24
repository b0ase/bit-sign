import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendCoSignNotification } from '@/lib/email';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/co-sign-respond
 * Submit a co-signed response. Links the response document to the co-sign request.
 * Called after the recipient seals their co-signed version.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { requestId, responseDocumentId } = await request.json();

        if (!requestId || !responseDocumentId) {
            return NextResponse.json({ error: 'Missing requestId or responseDocumentId' }, { status: 400 });
        }

        // Verify the co-sign request exists and is pending
        const { data: coSignReq } = await supabaseAdmin
            .from('co_sign_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (!coSignReq) {
            return NextResponse.json({ error: 'Co-sign request not found' }, { status: 404 });
        }

        if (coSignReq.status !== 'pending') {
            return NextResponse.json({ error: 'Co-sign request already responded to' }, { status: 400 });
        }

        // Verify this user is the intended recipient
        if (coSignReq.recipient_handle && coSignReq.recipient_handle !== handle) {
            return NextResponse.json({ error: 'You are not the recipient of this request' }, { status: 403 });
        }

        // Verify the response document exists and belongs to the responder
        const { data: responseSig } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type')
            .eq('id', responseDocumentId)
            .single();

        if (!responseSig) {
            return NextResponse.json({ error: 'Response document not found' }, { status: 404 });
        }

        if (responseSig.user_handle !== handle) {
            return NextResponse.json({ error: 'Response document not owned by you' }, { status: 403 });
        }

        // Update the co-sign request
        const { error: updateError } = await supabaseAdmin
            .from('co_sign_requests')
            .update({
                status: 'signed',
                response_document_id: responseDocumentId,
                signed_at: new Date().toISOString(),
                recipient_handle: handle, // Set if it was an email-based request
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // Share the response document back to the sender
        const { data: existingGrant } = await supabaseAdmin
            .from('document_access_grants')
            .select('id')
            .eq('document_id', responseDocumentId)
            .eq('grantee_handle', coSignReq.sender_handle)
            .is('revoked_at', null)
            .maybeSingle();

        if (!existingGrant) {
            await supabaseAdmin
                .from('document_access_grants')
                .insert({
                    document_id: responseDocumentId,
                    document_type: 'vault_item',
                    grantor_handle: handle,
                    grantee_handle: coSignReq.sender_handle,
                    wrapped_key: 'co-sign-response',
                    encryption_version: 0,
                });
        }

        // Send email notification to the original sender
        let emailSent = false;
        const { data: senderIdentity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('google_email, microsoft_email')
            .eq('user_handle', coSignReq.sender_handle)
            .maybeSingle();

        const senderEmail = senderIdentity?.google_email || senderIdentity?.microsoft_email;

        if (senderEmail) {
            // Get document name from original document
            const { data: originalDoc } = await supabaseAdmin
                .from('bit_sign_signatures')
                .select('metadata')
                .eq('id', coSignReq.document_id)
                .maybeSingle();

            const documentName = originalDoc?.metadata?.originalFileName || originalDoc?.metadata?.fileName || 'Sealed Document';
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online';

            const emailResult = await sendCoSignNotification({
                recipientEmail: senderEmail,
                signerHandle: handle,
                documentName,
                viewUrl: `${appUrl}/user/account`,
            });

            emailSent = emailResult.success;

            if (emailResult.success) {
                await supabaseAdmin
                    .from('co_sign_requests')
                    .update({ notified_sender: true })
                    .eq('id', requestId);
            }
        }

        // Auto-create peer_attestation/cosign strands for both parties
        try {
            const senderHandle = coSignReq.sender_handle;

            // Look up both identities
            const { data: recipientIdentity } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('id, token_id')
                .eq('user_handle', handle)
                .maybeSingle();

            const { data: senderIdentityRecord } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('id, token_id')
                .eq('user_handle', senderHandle)
                .maybeSingle();

            // Helper to create strand if it doesn't already exist for this request
            const createCosignStrand = async (
                identity: { id: string; token_id: string },
                userHandle: string,
                counterpartyHandle: string
            ) => {
                const { data: existing } = await supabaseAdmin
                    .from('bit_sign_strands')
                    .select('id')
                    .eq('identity_id', identity.id)
                    .eq('strand_type', 'peer_attestation')
                    .eq('strand_subtype', 'cosign')
                    .contains('metadata', { requestId })
                    .maybeSingle();

                if (!existing) {
                    await createStrand({
                        identityId: identity.id,
                        rootTxid: identity.token_id,
                        strandType: 'peer_attestation',
                        strandSubtype: 'cosign',
                        label: `Co-signed with $${counterpartyHandle}`,
                        metadata: { requestId, counterpartyHandle },
                        userHandle,
                    });
                    console.log(`[co-sign-respond] Created peer_attestation/cosign strand for ${userHandle}`);
                }
            };

            if (recipientIdentity) {
                await createCosignStrand(recipientIdentity, handle, senderHandle);
            }
            if (senderIdentityRecord) {
                await createCosignStrand(senderIdentityRecord, senderHandle, handle);
            }
        } catch (strandErr) {
            console.warn('[co-sign-respond] peer_attestation strand creation failed (non-fatal):', strandErr);
        }

        return NextResponse.json({
            success: true,
            emailSent,
        });
    } catch (error: any) {
        console.error('[co-sign-respond] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to respond to co-sign request' }, { status: 500 });
    }
}
