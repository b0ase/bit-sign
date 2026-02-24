import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData, hashData } from '@/lib/bsv-inscription';
import { createStrand } from '@/lib/identity-strands';

/**
 * POST /api/bitsign/ip-thread
 * Register a sealed document as a $401 IP thread.
 * Creates an on-chain inscription with the document hash and a strand linking it to the identity.
 *
 * Body: { documentId, title, description? }
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { documentId, title, description } = await request.json();

        if (!documentId || !title?.trim()) {
            return NextResponse.json({ error: 'Missing documentId or title' }, { status: 400 });
        }

        // Verify the document exists and belongs to the user
        const { data: doc } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, signature_type, payload_hash, txid, metadata, user_handle')
            .eq('id', documentId)
            .single();

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        if (doc.user_handle !== handle) {
            return NextResponse.json({ error: 'Document does not belong to you' }, { status: 403 });
        }

        // Only sealed documents can be registered as IP threads
        if (doc.signature_type !== 'SEALED_DOCUMENT') {
            return NextResponse.json({
                error: 'Only sealed documents can be registered as IP threads. Seal the document first.'
            }, { status: 400 });
        }

        // Look up identity
        const { data: identity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('id, token_id')
            .eq('user_handle', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({
                error: 'No identity token found. Mint your identity first.'
            }, { status: 400 });
        }

        // Check if this document is already registered as an IP thread
        const { data: existingStrand } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id')
            .eq('identity_id', identity.id)
            .eq('strand_type', 'ip_thread')
            .contains('metadata', { documentId })
            .maybeSingle();

        if (existingStrand) {
            return NextResponse.json({ error: 'This document is already registered as an IP thread' }, { status: 400 });
        }

        // Count existing IP threads to determine sequence number
        const { count } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id', { count: 'exact', head: true })
            .eq('identity_id', identity.id)
            .eq('strand_type', 'ip_thread');

        const sequence = (count || 0) + 1;

        // The document hash is the content hash of the sealed document
        const documentHash = doc.payload_hash || await hashData(documentId + handle + Date.now());

        // Inscribe on-chain as IP thread
        let inscriptionTxid: string | undefined;
        try {
            const result = await inscribeBitSignData({
                type: 'ip_thread',
                rootTxid: identity.token_id,
                documentHash,
                threadTitle: title.trim(),
                threadSequence: sequence,
                userHandle: handle,
            });
            inscriptionTxid = result.txid;
            console.log(`[ip-thread] On-chain inscription: ${inscriptionTxid}`);
        } catch (err) {
            console.warn('[ip-thread] On-chain inscription failed (non-fatal):', err);
        }

        // Create the ip_thread strand
        const strand = await createStrand({
            identityId: identity.id,
            rootTxid: identity.token_id,
            strandType: 'ip_thread',
            signatureId: documentId,
            label: `IP: ${title.trim()}`,
            metadata: {
                documentId,
                documentHash,
                title: title.trim(),
                description: description?.trim() || '',
                sequence,
                documentTxid: doc.txid,
                registeredAt: new Date().toISOString(),
            },
            userHandle: handle,
        });

        console.log(`[ip-thread] Created IP thread strand for ${handle}: ${strand.id} (seq #${sequence})`);

        return NextResponse.json({
            success: true,
            strandId: strand.id,
            strandTxid: strand.strand_txid,
            inscriptionTxid,
            sequence,
        });
    } catch (error: any) {
        console.error('[ip-thread] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to register IP thread' }, { status: 500 });
    }
}

/**
 * GET /api/bitsign/ip-thread
 * Get all IP threads for the current user's identity.
 */
export async function GET(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: identity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('id')
            .eq('user_handle', handle)
            .maybeSingle();

        if (!identity) {
            return NextResponse.json({ threads: [] });
        }

        const { data: threads } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id, strand_txid, label, metadata, created_at, signature_id')
            .eq('identity_id', identity.id)
            .eq('strand_type', 'ip_thread')
            .order('created_at', { ascending: true });

        return NextResponse.json({ threads: threads || [] });
    } catch (error: any) {
        console.error('[ip-thread] GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch IP threads' }, { status: 500 });
    }
}
