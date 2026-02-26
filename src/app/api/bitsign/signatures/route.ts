import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStrandsForIdentity } from '@/lib/identity-strands';

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
        const showTrash = searchParams.get('trash') === 'true';
        let sigQuery = supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, payload_hash, iv, txid, metadata, created_at, wallet_signed, wallet_signature, wallet_address, deleted_at')
            .eq('user_handle', handle);

        if (showTrash) {
            sigQuery = sigQuery.not('deleted_at', 'is', null);
        } else {
            sigQuery = sigQuery.is('deleted_at', null);
        }

        const { data: signatures, error: sigError } = await sigQuery
            .order('created_at', { ascending: false });

        if (sigError) throw sigError;

        // 3. Fetch strands if identity exists
        let strands: any[] = [];
        if (identity) {
            strands = await getStrandsForIdentity(identity.id);
        }

        return NextResponse.json({
            identity,
            signatures: signatures || [],
            strands,
            identity_strength: identity?.identity_strength || 0,
        });
    } catch (error: any) {
        console.error('[SignaturesAPI] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
