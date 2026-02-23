import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authToken = request.cookies.get('handcash_auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const handleCookie = request.cookies.get('handcash_handle')?.value;
        if (!handleCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: signature, error } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, encrypted_payload, iv, metadata')
            .eq('id', id)
            .eq('user_handle', handleCookie)
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
