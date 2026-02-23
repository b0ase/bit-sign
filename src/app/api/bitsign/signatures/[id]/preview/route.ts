import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Server-side decrypt and stream a signature's encrypted payload.
 * This avoids sending large base64 JSON to the client.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authToken = request.cookies.get('handcash_auth_token')?.value;
        const handleCookie = request.cookies.get('handcash_handle')?.value;

        if (!handleCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the signature data
        const { data: signature, error: sigError } = await supabaseAdmin
            .from('bit_sign_signatures')
            .select('id, user_handle, signature_type, encrypted_payload, iv, metadata')
            .eq('id', id)
            .eq('user_handle', handleCookie)
            .single();

        if (sigError || !signature) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        if (!signature.encrypted_payload || !signature.iv) {
            return NextResponse.json({ error: 'No encrypted data' }, { status: 404 });
        }

        // Get the user's encryption key from DB
        const { data: identity } = await supabaseAdmin
            .from('bit_sign_identities')
            .select('encryption_key')
            .eq('user_handle', handleCookie)
            .maybeSingle();

        if (!identity?.encryption_key) {
            return NextResponse.json({ error: 'No encryption key' }, { status: 400 });
        }

        // Decrypt server-side
        const encryptedBytes = Buffer.from(signature.encrypted_payload, 'base64');
        const ivBytes = Buffer.from(signature.iv, 'base64');

        // Derive the AES key the same way the client does
        const encoder = new TextEncoder();
        const seedBytes = encoder.encode(identity.encryption_key);
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
