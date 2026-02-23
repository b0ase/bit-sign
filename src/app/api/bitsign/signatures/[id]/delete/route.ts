import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authToken = request.cookies.get('handcash_auth_token')?.value;
        const handleCookie = request.cookies.get('handcash_handle')?.value;

        if (!authToken || !handleCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only delete if it belongs to this user
        const { error } = await supabaseAdmin
            .from('bit_sign_signatures')
            .delete()
            .eq('id', id)
            .eq('user_handle', handleCookie);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[SignatureDelete] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
