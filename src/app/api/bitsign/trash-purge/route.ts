import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const TRASH_RETENTION_DAYS = 30;

/**
 * POST /api/bitsign/trash-purge
 * Permanently deletes items that have been in trash for more than 30 days.
 * Called on page load — only purges the current user's items.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400000).toISOString();

        const { data: expired, error: fetchErr } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id')
            .eq('user_handle', handle)
            .not('deleted_at', 'is', null)
            .lt('deleted_at', cutoff);

        if (fetchErr) throw fetchErr;

        if (!expired || expired.length === 0) {
            return NextResponse.json({ purged: 0 });
        }

        const ids = expired.map(e => e.id);
        const { error: delErr } = await supabaseAdmin
            .from('bit_sign_signatures')
            .delete()
            .in('id', ids)
            .eq('user_handle', handle);

        if (delErr) throw delErr;

        return NextResponse.json({ purged: ids.length });
    } catch (error: any) {
        console.error('[trash-purge] Error:', error);
        return NextResponse.json({ error: error.message || 'Purge failed' }, { status: 500 });
    }
}
