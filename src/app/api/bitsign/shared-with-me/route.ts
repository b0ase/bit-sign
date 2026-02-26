import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * GET — Return all active access grants for the current user.
 * Also auto-claims any pending co-sign requests matched by email.
 * Joins with document metadata for display.
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Look up user's known emails for email-based matching
        const { data: userIdentity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('google_email, microsoft_email')
            .eq('user_handle', handle)
            .maybeSingle();

        const userEmails = [
            userIdentity?.google_email,
            userIdentity?.microsoft_email,
        ].filter(Boolean) as string[];

        // Auto-backfill: find pending co-sign requests sent to our email but missing access grants
        if (userEmails.length > 0) {
            const { data: emailRequests } = await supabaseAdmin
                .from('co_sign_requests')
                .select('id, document_id, sender_handle, recipient_handle')
                .in('recipient_email', userEmails)
                .eq('status', 'pending');

            for (const req of emailRequests || []) {
                // Update recipient_handle if not set
                if (!req.recipient_handle || req.recipient_handle !== handle) {
                    await supabaseAdmin
                        .from('co_sign_requests')
                        .update({ recipient_handle: handle })
                        .eq('id', req.id);
                }

                // Create access grant if missing
                const { data: existingGrant } = await supabaseAdmin
                    .from('document_access_grants')
                    .select('id')
                    .eq('document_id', req.document_id)
                    .eq('grantee_handle', handle)
                    .is('revoked_at', null)
                    .maybeSingle();

                if (!existingGrant) {
                    await supabaseAdmin
                        .from('document_access_grants')
                        .insert({
                            document_id: req.document_id,
                            document_type: 'vault_item',
                            grantor_handle: req.sender_handle,
                            grantee_handle: handle,
                            wrapped_key: 'co-sign-request',
                            encryption_version: 0,
                        });
                }
            }
        }

        // Fetch all non-revoked grants for this user
        const { data: grants, error } = await supabaseAdmin
            .from('document_access_grants')
            .select('*')
            .eq('grantee_handle', handle)
            .is('revoked_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with document metadata
        const enrichedGrants = await Promise.all(
            (grants || []).map(async (grant) => {
                if (grant.document_type === 'vault_item') {
                    const { data: sig } = await supabaseAdmin
                        .from('bit_sign_signatures')
                        .select('signature_type, metadata, created_at')
                        .eq('id', grant.document_id)
                        .maybeSingle();

                    // Resolve the real document name — walk up the seal chain if needed
                    let resolvedMeta = sig?.metadata ? { ...sig.metadata } : {};
                    const metaName = resolvedMeta?.fileName || resolvedMeta?.originalFileName;
                    if (sig?.signature_type === 'SEALED_DOCUMENT' && (!metaName || metaName === 'Sealed Document')) {
                        let walkDocId = resolvedMeta?.originalDocumentId;
                        let depth = 0;
                        while (walkDocId && depth < 5) {
                            const { data: parentDoc } = await supabaseAdmin
                                .from('bit_sign_signatures')
                                .select('metadata')
                                .eq('id', walkDocId)
                                .maybeSingle();
                            if (!parentDoc) break;
                            const name = parentDoc.metadata?.fileName || parentDoc.metadata?.originalFileName;
                            if (name && name !== 'Sealed Document') {
                                resolvedMeta.originalFileName = name;
                                break;
                            }
                            walkDocId = parentDoc.metadata?.originalDocumentId;
                            depth++;
                        }
                    }

                    return {
                        ...grant,
                        signature_type: sig?.signature_type,
                        metadata: resolvedMeta,
                        document_created_at: sig?.created_at,
                    };
                }
                return grant;
            })
        );

        return NextResponse.json({ grants: enrichedGrants });
    } catch (error: any) {
        console.error('[shared-with-me] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch shared documents' }, { status: 500 });
    }
}
