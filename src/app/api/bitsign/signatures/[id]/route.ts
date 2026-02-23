import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: signature, error } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, encrypted_payload, iv, metadata')
            .eq('id', id)
            .eq('user_handle', handle)
            .single();

        if (error || !signature) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json(signature);
    } catch (error: any) {
        console.error('[SignatureDetail] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
