import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * POST — Create a document access grant (share an encrypted document).
 * Validates that the grantor owns the document.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            document_id,
            document_type,
            grantee_handle,
            wrapped_key,
            ephemeral_public_key,
        } = await request.json();

        if (!document_id || !document_type || !grantee_handle || !wrapped_key) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (grantee_handle === handle) {
            return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 });
        }

        // Validate grantor owns the document
        if (document_type === 'vault_item') {
            const { data: sig } = await supabaseAdmin
                .from('bit_sign_signatures')
                .select('id, user_handle')
                .eq('id', document_id)
                .single();

            if (!sig || sig.user_handle !== handle) {
                return NextResponse.json({ error: 'Document not found or not owned by you' }, { status: 403 });
            }
        } else if (document_type === 'envelope') {
            const { data: env } = await supabaseAdmin
                .from('signing_envelopes')
                .select('id, creator_handle')
                .eq('id', document_id)
                .single();

            if (!env || env.creator_handle !== handle) {
                return NextResponse.json({ error: 'Envelope not found or not owned by you' }, { status: 403 });
            }
        } else {
            return NextResponse.json({ error: 'Invalid document_type' }, { status: 400 });
        }

        // Verify grantee exists and has E2E keys
        const { data: granteeIdentity } = await supabaseAdmin
            .from('user_identities')
            .select('unified_user_id')
            .eq('provider', 'handcash')
            .eq('provider_user_id', grantee_handle)
            .maybeSingle();

        if (!granteeIdentity) {
            return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }

        const { data: granteeUser } = await supabaseAdmin
            .from('unified_users')
            .select('public_key')
            .eq('id', granteeIdentity.unified_user_id)
            .single();

        if (!granteeUser?.public_key) {
            return NextResponse.json({ error: 'Recipient has not set up E2E encryption' }, { status: 400 });
        }

        // Create the access grant
        const { data: grant, error: insertError } = await supabaseAdmin
            .from('document_access_grants')
            .insert({
                document_id,
                document_type,
                grantor_handle: handle,
                grantee_handle,
                wrapped_key,
                ephemeral_public_key: ephemeral_public_key || null,
                encryption_version: 2,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return NextResponse.json({ success: true, grant });
    } catch (error: any) {
        console.error('[share] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to share document' }, { status: 500 });
    }
}
