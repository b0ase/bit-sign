import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * DELETE /api/bitsign/signatures/[id]/delete
 * Soft-delete: sets deleted_at timestamp. Item moves to trash for 30 days.
 *
 * Query param ?permanent=true for hard delete (from trash).
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const handle = await resolveUserHandle(request);

        if (!handle) {
            return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
        }

        const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

        if (permanent) {
            // Hard delete — only allowed for items already in trash
            const { data: existing } = await supabaseAdmin
                .from('bit_sign_signatures')
                .select('id, deleted_at')
                .eq('id', id)
                .eq('user_handle', handle)
                .not('deleted_at', 'is', null)
                .maybeSingle();

            if (!existing) {
                return NextResponse.json({ error: 'Item not in trash or not found' }, { status: 404 });
            }

            const { error } = await supabaseAdmin
                .from('bit_sign_signatures')
                .delete()
                .eq('id', id)
                .eq('user_handle', handle);

            if (error) throw error;
            return NextResponse.json({ success: true, permanent: true });
        }

        // Soft delete — set deleted_at
        const { error } = await supabaseAdmin
            .from('bit_sign_signatures')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_handle', handle)
            .is('deleted_at', null);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[SignatureDelete] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/bitsign/signatures/[id]/delete
 * Restore from trash — clears deleted_at.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const handle = await resolveUserHandle(request);

        if (!handle) {
            return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
        }

        const { error } = await supabaseAdmin
            .from('bit_sign_signatures')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('user_handle', handle)
            .not('deleted_at', 'is', null);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[SignatureRestore] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
