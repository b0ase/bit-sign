import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendCoSignRequestEmail } from '@/lib/email';
import crypto from 'crypto';

/**
 * POST /api/bitsign/co-sign-request
 * Create a co-sign request. Shares the document and optionally sends email notification.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { documentId, recipientHandle, recipientEmail, message } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
        }

        if (!recipientHandle && !recipientEmail) {
            return NextResponse.json({ error: 'Must provide recipientHandle or recipientEmail' }, { status: 400 });
        }

        // Verify sender owns the document and it's a sealed document
        const { data: doc } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, metadata')
            .eq('id', documentId)
            .single();

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        if (doc.user_handle !== handle) {
            // Also check if user has an access grant (shared doc)
            const { data: grant } = await supabaseAdmin
                .from('document_access_grants')
                .select('id')
                .eq('document_id', documentId)
                .eq('grantee_handle', handle)
                .is('revoked_at', null)
                .maybeSingle();

            if (!grant) {
                return NextResponse.json({ error: 'Document not owned by you' }, { status: 403 });
            }
        }

        if (doc.signature_type !== 'SEALED_DOCUMENT') {
            return NextResponse.json({ error: 'Only sealed documents can be co-signed' }, { status: 400 });
        }

        const cleanHandle = recipientHandle?.replace(/^\$/, '') || null;
        if (cleanHandle === handle) {
            return NextResponse.json({ error: 'Cannot request co-sign from yourself' }, { status: 400 });
        }

        const documentName = doc.metadata?.originalFileName || doc.metadata?.fileName || 'Sealed Document';
        const claimToken = crypto.randomUUID();

        // Create the co-sign request
        const { data: coSignReq, error: insertError } = await supabaseAdmin
            .from('co_sign_requests')
            .insert({
                document_id: documentId,
                sender_handle: handle,
                recipient_handle: cleanHandle,
                recipient_email: recipientEmail || null,
                claim_token: claimToken,
                message: message || null,
                status: 'pending',
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // If sharing by handle, also create an access grant so recipient can view
        if (cleanHandle) {
            // Check if grant already exists
            const { data: existingGrant } = await supabaseAdmin
                .from('document_access_grants')
                .select('id')
                .eq('document_id', documentId)
                .eq('grantee_handle', cleanHandle)
                .is('revoked_at', null)
                .maybeSingle();

            if (!existingGrant) {
                // Create a basic access grant (no E2E wrapping — co-sign flow uses direct access)
                await supabaseAdmin
                    .from('document_access_grants')
                    .insert({
                        document_id: documentId,
                        document_type: 'vault_item',
                        grantor_handle: handle,
                        grantee_handle: cleanHandle,
                        wrapped_key: 'co-sign-request',
                        encryption_version: 0,
                    });
            }
        }

        // Send email notification if recipient has an email or recipientEmail provided
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online';
        let emailSent = false;

        if (recipientEmail) {
            const claimUrl = `${appUrl}/user/account`;
            const emailResult = await sendCoSignRequestEmail({
                recipientEmail,
                senderHandle: handle,
                documentName,
                claimUrl,
                message: message || undefined,
            });
            emailSent = emailResult.success;
        } else if (cleanHandle) {
            // Try to find recipient's email from identity
            const { data: recipientIdentity } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('google_email, microsoft_email')
                .eq('user_handle', cleanHandle)
                .maybeSingle();

            const email = recipientIdentity?.google_email || recipientIdentity?.microsoft_email;
            if (email) {
                const claimUrl = `${appUrl}/user/account`;
                const emailResult = await sendCoSignRequestEmail({
                    recipientEmail: email,
                    senderHandle: handle,
                    documentName,
                    claimUrl,
                    message: message || undefined,
                });
                emailSent = emailResult.success;
            }
        }

        return NextResponse.json({
            success: true,
            requestId: coSignReq.id,
            emailSent,
        });
    } catch (error: any) {
        console.error('[co-sign-request] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create co-sign request' }, { status: 500 });
    }
}

/**
 * GET /api/bitsign/co-sign-request
 * List co-sign requests where current user is the recipient.
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: requests, error } = await supabaseAdmin
            .from('co_sign_requests')
            .select('*')
            .eq('recipient_handle', handle)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with document metadata
        const enriched = await Promise.all(
            (requests || []).map(async (req) => {
                const { data: sig } = await supabaseAdmin
                    .from('bit_sign_signatures')
                    .select('signature_type, metadata, txid, created_at')
                    .eq('id', req.document_id)
                    .maybeSingle();

                return {
                    ...req,
                    document_name: sig?.metadata?.originalFileName || sig?.metadata?.fileName || 'Sealed Document',
                    document_txid: sig?.txid,
                    document_created_at: sig?.created_at,
                };
            })
        );

        return NextResponse.json({ requests: enriched });
    } catch (error: any) {
        console.error('[co-sign-request] GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch co-sign requests' }, { status: 500 });
    }
}
