import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/self-attest
 * Submit a self-attestation (full legal name + address) to upgrade identity to Lv.2.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fullName, addressLine1, addressLine2, city, postcode, country } = await request.json();

        // Validate required fields
        if (!fullName?.trim() || !addressLine1?.trim() || !city?.trim() || !postcode?.trim() || !country?.trim()) {
            return NextResponse.json({
                error: 'Missing required fields: fullName, addressLine1, city, postcode, country'
            }, { status: 400 });
        }

        // Look up identity
        const { data: identity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('id, token_id')
            .eq('user_handle', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ error: 'No identity token found. Mint your identity first.' }, { status: 400 });
        }

        // Check if self_attestation strand already exists
        const { data: existingStrand } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id')
            .eq('identity_id', identity.id)
            .eq('strand_type', 'self_attestation')
            .maybeSingle();

        if (existingStrand) {
            return NextResponse.json({ error: 'Self-attestation already submitted' }, { status: 400 });
        }

        // Create the self_attestation strand
        const result = await createStrand({
            identityId: identity.id,
            rootTxid: identity.token_id,
            strandType: 'self_attestation',
            label: `Self-attested: ${fullName.trim()}`,
            metadata: {
                fullName: fullName.trim(),
                addressLine1: addressLine1.trim(),
                addressLine2: addressLine2?.trim() || '',
                city: city.trim(),
                postcode: postcode.trim(),
                country: country.trim(),
                attestedAt: new Date().toISOString(),
            },
            userHandle: handle,
        });

        console.log(`[self-attest] Created self_attestation strand for ${handle}: ${result.id}`);

        return NextResponse.json({
            success: true,
            strandId: result.id,
            strandTxid: result.strand_txid,
        });
    } catch (error: any) {
        console.error('[self-attest] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to submit self-attestation' }, { status: 500 });
    }
}
