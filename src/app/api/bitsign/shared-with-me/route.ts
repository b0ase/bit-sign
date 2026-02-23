import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * GET — Return all active access grants for the current user.
 * Joins with document metadata for display.
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

                    return {
                        ...grant,
                        signature_type: sig?.signature_type,
                        metadata: sig?.metadata,
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
