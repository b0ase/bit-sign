import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * POST /api/bitsign/return-to-sender
 * When a user seals a received document (shared via email invite, not co-sign request),
 * auto-create an access grant so the original sender can see the signed version.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sealedDocId, senderHandle } = await request.json();
        if (!sealedDocId || !senderHandle) {
            return NextResponse.json({ error: 'Missing sealedDocId or senderHandle' }, { status: 400 });
        }

        // Verify the sealed doc belongs to the current user
        const { data: doc } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, encryption_version')
            .eq('id', sealedDocId)
            .maybeSingle();

        if (!doc || doc.user_handle !== handle) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Verify the recipient exists
        const { data: recipientIdentity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('id')
            .eq('user_handle', senderHandle)
            .maybeSingle();

        if (!recipientIdentity) {
            return NextResponse.json({ error: 'Recipient not found. Check the handle.' }, { status: 404 });
        }

        // Check for existing grant to avoid duplicates
        const { data: existing } = await supabaseAdmin
            .from('document_access_grants')
            .select('id')
            .eq('document_id', sealedDocId)
            .eq('grantee_handle', senderHandle)
            .is('revoked_at', null)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ success: true, message: 'Already shared' });
        }

        // Create access grant back to the original sender
        const { error } = await supabaseAdmin
            .from('document_access_grants')
            .insert({
                document_id: sealedDocId,
                document_type: 'vault_item',
                grantor_handle: handle,
                grantee_handle: senderHandle,
                wrapped_key: 'co-sign-response',
                encryption_version: doc.encryption_version || 0,
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[return-to-sender] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to return document' }, { status: 500 });
    }
}
