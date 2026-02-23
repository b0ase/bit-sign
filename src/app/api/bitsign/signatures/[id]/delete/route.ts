import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

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

        // Only delete if it belongs to this user
        const { error } = await supabaseAdmin
            .from('bit_sign_signatures')
            .delete()
            .eq('id', id)
            .eq('user_handle', handle);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[SignatureDelete] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
