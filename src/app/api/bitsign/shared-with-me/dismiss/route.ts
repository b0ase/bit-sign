import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/bitsign/shared-with-me/dismiss
 * Revoke (soft-delete) an access grant so it no longer appears in the user's inbox.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { grantId } = await request.json();
        if (!grantId) {
            return NextResponse.json({ error: 'Missing grantId' }, { status: 400 });
        }

        // Verify this grant belongs to the user
        const { data: grant } = await supabaseAdmin
            .from('document_access_grants')
            .select('id, grantee_handle')
            .eq('id', grantId)
            .maybeSingle();

        if (!grant || grant.grantee_handle !== handle) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Soft-delete by setting revoked_at
        const { error } = await supabaseAdmin
            .from('document_access_grants')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', grantId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[shared-with-me/dismiss] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to dismiss' }, { status: 500 });
    }
}
