import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/id-document
 * Upload an ID document (passport, utility bill, driving licence) and create the corresponding strand.
 * The actual file is already uploaded as a vault signature — this endpoint links it as an identity strand.
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { signatureId, documentType } = await request.json();

        // Validate document type
        const validTypes: Record<string, string> = {
            passport: 'passport',
            utility_bill: 'proof_of_address',
            driving_licence: 'driving_licence',
        };

        const subtype = validTypes[documentType];
        if (!subtype) {
            return NextResponse.json({
                error: 'Invalid document type. Must be: passport, utility_bill, or driving_licence'
            }, { status: 400 });
        }

        if (!signatureId) {
            return NextResponse.json({ error: 'signatureId is required' }, { status: 400 });
        }

        // Verify the signature belongs to this user
        const { data: sig } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id')
            .eq('id', signatureId)
            .eq('user_handle', handle)
            .maybeSingle();

        if (!sig) {
            return NextResponse.json({ error: 'Signature not found or not yours' }, { status: 404 });
        }

        // Look up identity
        const { data: identity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('id, token_id')
            .eq('user_handle', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ error: 'No identity token found.' }, { status: 400 });
        }

        // Check if this type of strand already exists
        const { data: existingStrand } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id')
            .eq('identity_id', identity.id)
            .eq('strand_type', 'id_document')
            .eq('strand_subtype', subtype)
            .maybeSingle();

        if (existingStrand) {
            return NextResponse.json({
                error: `A ${documentType.replace('_', ' ')} has already been submitted. You can only have one.`
            }, { status: 400 });
        }

        const labels: Record<string, string> = {
            passport: 'Passport',
            utility_bill: 'Proof of Address (Utility Bill)',
            driving_licence: 'Driving Licence',
        };

        // Create the id_document strand
        const result = await createStrand({
            identityId: identity.id,
            rootTxid: identity.token_id,
            strandType: 'id_document',
            strandSubtype: subtype,
            signatureId,
            label: labels[documentType] || documentType,
            metadata: {
                documentType,
                uploadedAt: new Date().toISOString(),
            },
            userHandle: handle,
        });

        console.log(`[id-document] Created id_document/${subtype} strand for ${handle}: ${result.id}`);

        return NextResponse.json({
            success: true,
            strandId: result.id,
            strandTxid: result.strand_txid,
        });
    } catch (error: any) {
        console.error('[id-document] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to submit ID document' }, { status: 500 });
    }
}
