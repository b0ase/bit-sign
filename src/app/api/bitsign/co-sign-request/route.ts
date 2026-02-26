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

        const { documentId, recipientHandle, recipientEmail, message, requestType } = await request.json();

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

        let cleanHandle = recipientHandle?.replace(/^\$/, '') || null;
        let finalEmail = recipientEmail || null;

        // Detect if an email was entered in the handle field
        if (cleanHandle && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanHandle)) {
            finalEmail = finalEmail || cleanHandle;
            cleanHandle = null; // Not a handle — it's an email
        }

        // If we have an email but no handle, try to resolve the handle from known identities
        let resolvedHandle = cleanHandle;
        if (!resolvedHandle && finalEmail) {
            const { data: identityByEmail } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('user_handle')
                .or(`google_email.eq.${finalEmail},microsoft_email.eq.${finalEmail}`)
                .maybeSingle();
            if (identityByEmail) {
                resolvedHandle = identityByEmail.user_handle;
            }
        }

        if (resolvedHandle === handle || cleanHandle === handle) {
            return NextResponse.json({ error: 'Cannot request co-sign from yourself' }, { status: 400 });
        }

        // Resolve real name — walk up seal chain if needed
        let documentName = doc.metadata?.originalFileName || doc.metadata?.fileName || null;
        if (!documentName || documentName === 'Sealed Document') {
            let walkDocId = doc.metadata?.originalDocumentId;
            let depth = 0;
            while (walkDocId && depth < 5) {
                const { data: parentDoc } = await supabaseAdmin
                    .from('bit_sign_signatures')
                    .select('metadata')
                    .eq('id', walkDocId)
                    .maybeSingle();
                if (!parentDoc) break;
                const name = parentDoc.metadata?.fileName || parentDoc.metadata?.originalFileName;
                if (name && name !== 'Sealed Document') { documentName = name; break; }
                walkDocId = parentDoc.metadata?.originalDocumentId;
                depth++;
            }
        }
        if (!documentName || documentName === 'Sealed Document') documentName = 'Document';
        const claimToken = crypto.randomUUID();

        // Create the co-sign request
        const { data: coSignReq, error: insertError } = await supabaseAdmin
            .from('co_sign_requests')
            .insert({
                document_id: documentId,
                sender_handle: handle,
                recipient_handle: resolvedHandle,
                recipient_email: finalEmail,
                claim_token: claimToken,
                message: message || null,
                request_type: requestType === 'witness' ? 'witness' : 'co-sign',
                status: 'pending',
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Create an access grant so recipient can view
        const granteeHandle = resolvedHandle;
        if (granteeHandle) {
            // Check if grant already exists
            const { data: existingGrant } = await supabaseAdmin
                .from('document_access_grants')
                .select('id')
                .eq('document_id', documentId)
                .eq('grantee_handle', granteeHandle)
                .is('revoked_at', null)
                .maybeSingle();

            if (!existingGrant) {
                await supabaseAdmin
                    .from('document_access_grants')
                    .insert({
                        document_id: documentId,
                        document_type: 'vault_item',
                        grantor_handle: handle,
                        grantee_handle: granteeHandle,
                        wrapped_key: 'co-sign-request',
                        encryption_version: 0,
                    });
            }
        }

        // Send email notification
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit-sign.online';
        let emailSent = false;

        // Determine best email to send to
        let notifyEmail = finalEmail;
        if (!notifyEmail && resolvedHandle) {
            const { data: recipientIdentity } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('google_email, microsoft_email')
                .eq('user_handle', resolvedHandle)
                .maybeSingle();
            notifyEmail = recipientIdentity?.google_email || recipientIdentity?.microsoft_email || null;
        }

        if (notifyEmail) {
            const claimUrl = `${appUrl}/user/account`;
            const emailResult = await sendCoSignRequestEmail({
                recipientEmail: notifyEmail,
                senderHandle: handle,
                documentName,
                claimUrl,
                message: message || undefined,
            });
            emailSent = emailResult.success;
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

        // Look up user's known emails to also match email-based requests
        const { data: userIdentity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('google_email, microsoft_email')
            .eq('user_handle', handle)
            .maybeSingle();

        const userEmails = [
            userIdentity?.google_email,
            userIdentity?.microsoft_email,
        ].filter(Boolean) as string[];

        // Match by handle OR by email
        let orFilter = `recipient_handle.eq.${handle}`;
        if (userEmails.length > 0) {
            const emailFilters = userEmails.map(e => `recipient_email.eq.${e}`).join(',');
            orFilter += `,${emailFilters}`;
        }

        const { data: requests, error } = await supabaseAdmin
            .from('co_sign_requests')
            .select('*')
            .or(orFilter)
            .neq('recipient_dismissed', true)
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

                // Resolve real name — walk up seal chain if needed
                let docName = sig?.metadata?.originalFileName || sig?.metadata?.fileName || null;
                if (!docName || docName === 'Sealed Document') {
                    let walkDocId = sig?.metadata?.originalDocumentId;
                    let depth = 0;
                    while (walkDocId && depth < 5) {
                        const { data: parentDoc } = await supabaseAdmin
                            .from('bit_sign_signatures')
                            .select('metadata')
                            .eq('id', walkDocId)
                            .maybeSingle();
                        if (!parentDoc) break;
                        const name = parentDoc.metadata?.fileName || parentDoc.metadata?.originalFileName;
                        if (name && name !== 'Sealed Document') { docName = name; break; }
                        walkDocId = parentDoc.metadata?.originalDocumentId;
                        depth++;
                    }
                }

                return {
                    ...req,
                    document_name: docName || 'Document',
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
