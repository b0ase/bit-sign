import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData, hashData } from '@/lib/bsv-inscription';
import { createStrand } from '@/lib/identity-strands';

const TRUST_TYPES = ['SEALED_DOCUMENT', 'DOCUMENT', 'PDF', 'IMAGE', 'PHOTO', 'VIDEO', 'BIT_TRUST'];

/**
 * POST /api/bitsign/ip-thread
 * Register a document (or hash) as a $401 IP thread.
 * Creates an on-chain inscription with the document hash and a strand linking it to the identity.
 *
 * Body: { documentId?, documentHash?, title, description? }
 * - Provide documentId to register an existing document
 * - Provide documentHash (without documentId) for hash-only registration
 */
export async function POST(request: NextRequest) {
    try {
        const handle = await resolveUserHandle(request);
        if (!handle) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { documentId, documentHash: providedHash, title, description } = await request.json();

        if (!title?.trim()) {
            return NextResponse.json({ error: 'Missing title' }, { status: 400 });
        }

        if (!documentId && !providedHash) {
            return NextResponse.json({ error: 'Provide either documentId or documentHash' }, { status: 400 });
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

        let documentHash: string;
        let documentType: string;
        let documentTxid: string | undefined;

        if (documentId) {
            // Document-based registration: verify the document exists and belongs to the user
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

            if (!TRUST_TYPES.includes(doc.signature_type)) {
                return NextResponse.json({
                    error: `Type "${doc.signature_type}" not supported for IP registration`
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

            documentHash = doc.payload_hash || await hashData(documentId + handle + Date.now());
            documentType = doc.signature_type;
            documentTxid = doc.txid;
        } else {
            // Hash-only registration
            documentHash = providedHash!;
            documentType = 'HASH_ONLY';

            // Check for duplicate hash registration
            const { data: existingStrand } = await supabaseAdmin
                .from('bit_sign_strands')
                .select('id')
                .eq('identity_id', identity.id)
                .eq('strand_type', 'ip_thread')
                .contains('metadata', { documentHash })
                .maybeSingle();

            if (existingStrand) {
                return NextResponse.json({ error: 'This hash is already registered as an IP thread' }, { status: 400 });
            }
        }

        // Count existing IP threads to determine sequence number
        const { count } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id', { count: 'exact', head: true })
            .eq('identity_id', identity.id)
            .eq('strand_type', 'ip_thread');

        const sequence = (count || 0) + 1;

        // Inscribe on-chain as IP thread
        let inscriptionTxid: string | undefined;
        try {
            const result = await inscribeBitSignData({
                type: 'ip_thread',
                rootTxid: identity.token_id,
                documentHash,
                documentType,
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
            signatureId: documentId || undefined,
            label: `IP: ${title.trim()}`,
            metadata: {
                ...(documentId ? { documentId } : {}),
                documentHash,
                documentType,
                title: title.trim(),
                description: description?.trim() || '',
                sequence,
                ...(documentTxid ? { documentTxid } : {}),
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
 * Returns enriched thread objects with document type, title, hash, etc.
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

        const { data: strands } = await supabaseAdmin
            .from('bit_sign_strands')
            .select('id, strand_txid, label, metadata, created_at, signature_id')
            .eq('identity_id', identity.id)
            .eq('strand_type', 'ip_thread')
            .order('created_at', { ascending: true });

        const threads = (strands || []).map(s => ({
            id: s.id,
            title: s.metadata?.title || s.label?.replace('IP: ', '') || 'Untitled',
            documentHash: s.metadata?.documentHash || '',
            documentType: s.metadata?.documentType || 'SEALED_DOCUMENT',
            sequence: s.metadata?.sequence || 0,
            txid: s.strand_txid || '',
            documentId: s.signature_id || s.metadata?.documentId || null,
            createdAt: s.created_at,
        }));

        return NextResponse.json({ threads });
    } catch (error: any) {
        console.error('[ip-thread] GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch IP threads' }, { status: 500 });
    }
}
