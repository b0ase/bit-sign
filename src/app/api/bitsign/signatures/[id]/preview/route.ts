import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveUserHandle } from '@/lib/auth';

/**
 * Server-side decrypt and stream a signature's encrypted payload.
 * Supports v1 (server decrypts) and v2 (returns encrypted payload for client decryption).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const handle = await resolveUserHandle(request);

        if (!handle) {
            return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
        }

        // Check if user owns the document OR has an access grant
        let signature = null;
        let isShared = false;

        // Try direct ownership first
        const { data: ownedSig } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, encrypted_payload, iv, metadata, encryption_version')
            .eq('id', id)
            .eq('user_handle', handle)
            .single();

        if (ownedSig) {
            signature = ownedSig;
        } else {
            // Check for access grant
            const { data: grant } = await supabaseAdmin
                .from('document_access_grants')
                .select('document_id')
                .eq('document_id', id)
                .eq('grantee_handle', handle)
                .is('revoked_at', null)
                .maybeSingle();

            if (grant) {
                const { data: sharedSig } = await supabaseAdmin
                    .from('bit_sign_signatures')
                    .select('id, user_handle, signature_type, encrypted_payload, iv, metadata, encryption_version')
                    .eq('id', id)
                    .single();

                if (sharedSig) {
                    signature = sharedSig;
                    isShared = true;
                }
            }
        }

        if (!signature) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        if (!signature.encrypted_payload || !signature.iv) {
            return NextResponse.json({ error: 'No encrypted data' }, { status: 404 });
        }

        const encryptionVersion = signature.encryption_version || 1;

        // v2: Return encrypted payload for client-side decryption
        if (encryptionVersion === 2 || isShared) {
            return NextResponse.json({
                encryption_version: encryptionVersion,
                encrypted_payload: signature.encrypted_payload,
                iv: signature.iv,
                signature_type: signature.signature_type,
                metadata: signature.metadata,
            });
        }

        // v1: Server-side decryption (legacy path)
        const { data: identityData } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('encryption_key')
            .eq('user_handle', handle)
            .maybeSingle();

        // Also check unified_users for the encryption_key
        let encryptionKey = identityData?.encryption_key;

        if (!encryptionKey) {
            const { data: userIdentity } = await supabaseAdmin
                .from('user_identities')
                .select('unified_user_id')
                .eq('provider', 'handcash')
                .eq('provider_user_id', handle)
                .maybeSingle();

            if (userIdentity) {
                const { data: unifiedUser } = await supabaseAdmin
                    .from('unified_users')
                    .select('encryption_key')
                    .eq('id', userIdentity.unified_user_id)
                    .single();

                encryptionKey = unifiedUser?.encryption_key;
            }
        }

        if (!encryptionKey) {
            return NextResponse.json({ error: 'No encryption key' }, { status: 400 });
        }

        // Decrypt server-side
        const encryptedBytes = Buffer.from(signature.encrypted_payload, 'base64');
        const ivBytes = Buffer.from(signature.iv, 'base64');

        const encoder = new TextEncoder();
        const seedBytes = encoder.encode(encryptionKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', seedBytes);

        const key = await crypto.subtle.importKey(
            'raw',
            hashBuffer,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        let decrypted: ArrayBuffer;
        try {
            decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBytes },
                key,
                encryptedBytes
            );
        } catch {
            return NextResponse.json({ error: 'Decryption failed — encryption key may have changed' }, { status: 422 });
        }

        // Determine content type
        let contentType = 'application/octet-stream';
        const meta = signature.metadata || {};
        const fileName = meta.fileName || 'file';

        if (signature.signature_type === 'TLDRAW') {
            contentType = 'image/svg+xml';
        } else if (meta.mimeType) {
            contentType = meta.mimeType;
        } else if (fileName.match(/\.pdf$/i)) {
            contentType = 'application/pdf';
        } else if (fileName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
            contentType = 'image/' + fileName.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg');
        }

        return new NextResponse(decrypted, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${fileName}"`,
                'Cache-Control': 'private, max-age=300',
            },
        });
    } catch (error: any) {
        console.error('[Preview] Error:', error);
        return NextResponse.json({ error: error.message || 'Preview failed' }, { status: 500 });
    }
}
