import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
        return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    try {
        // 1. Fetch Identity Token
        const { data: identity, error: identityError } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('*')
            .eq('user_handle', handle)
            .maybeSingle();

        if (identityError) throw identityError;

        // 2. Fetch Signature Chain (exclude large encrypted_payload from list)
        const { data: signatures, error: sigError } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, payload_hash, iv, txid, metadata, created_at')
            .eq('user_handle', handle)
            .order('created_at', { ascending: false });

        if (sigError) throw sigError;

        return NextResponse.json({
            identity,
            signatures: signatures || []
        });
    } catch (error: any) {
        console.error('[SignaturesAPI] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
