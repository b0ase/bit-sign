import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Fetch current signature
        const { data: signature, error: fetchErr } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, metadata')
            .eq('id', id)
            .eq('user_handle', handle)
            .single();

        if (fetchErr || !signature) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const updatedMetadata = { ...(signature.metadata || {}), ...body.metadata };

        const { error: updateErr } = await supabaseAdmin
            .from('bit_sign_signatures')
            .update({ metadata: updatedMetadata })
            .eq('id', id)
            .eq('user_handle', handle);

        if (updateErr) throw updateErr;

        return NextResponse.json({ ok: true, metadata: updatedMetadata });
    } catch (error: any) {
        console.error('[SignaturePatch] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
