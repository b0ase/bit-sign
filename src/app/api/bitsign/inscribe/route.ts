import { NextRequest, NextResponse } from 'next/server';
import { getUserAccount } from '@/lib/handcash';
import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData, hashData } from '@/lib/bsv-inscription';
import { linkExistingVaultItems, createStrand } from '@/lib/identity-strands';

/**
 * Handles storage (and optional on-chain inscription) of vault items.
 *
 * Two modes:
 *   1. Plaintext (default): `plaintextData` (base64) — stored as-is, preview works immediately.
 *      Encryption happens later when user pays to inscribe on-chain.
 *   2. Encrypted: `encryptedData` + `iv` — legacy path for pre-encrypted items.
 */
export async function POST(request: NextRequest) {
    try {
        const {
            plaintextData,
            encryptedData,
            iv,
            handle,
            metadata,
            signatureType = 'DOCUMENT',
            encryption_version,
        } = await request.json();

        const authToken = request.cookies.get('handcash_auth_token')?.value;

        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized: No wallet connected' }, { status: 401 });
        }

        const userAccount = getUserAccount(authToken);
        if (!userAccount) {
            return NextResponse.json({ error: 'Failed to resolve user account' }, { status: 401 });
        }

        // Calculate hash of the payload (plaintext or encrypted)
        const payloadForHash = plaintextData || encryptedData || JSON.stringify({ handle, signatureType, metadata });
        const payloadHash = await hashData(payloadForHash);

        // Attempt real blockchain inscription
        let txid: string;
        let inscriptionResult = null;

        try {
            inscriptionResult = await inscribeBitSignData({
                type: 'signature_registration',
                signatureHash: payloadHash,
                signatureType: signatureType === 'TLDRAW' ? 'drawn' : 'typed',
                ownerName: handle,
                walletType: 'handcash',
                createdAt: new Date().toISOString(),
            });
            txid = inscriptionResult.txid;
            console.log(`[inscribe] Real inscription: ${txid}`);
        } catch (inscribeError) {
            // Fallback: record in DB without blockchain if key not configured
            console.warn('[inscribe] Blockchain inscription failed, recording locally:', inscribeError);
            txid = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        }

        // Handle Identity Minting
        if (signatureType === 'IDENTITY_MINT') {
            // Use $HANDLE symbol (not $HANDLE-DNA)
            const tokenSymbol = `$${handle.toUpperCase()}`;
            const identityMetadata = { ...metadata, symbol: tokenSymbol };

            // Attempt identity_root on-chain inscription
            let rootTxid = txid;
            try {
                const rootInscription = await inscribeBitSignData({
                    type: 'identity_root',
                    userHandle: handle,
                    tokenSymbol,
                    walletType: 'handcash',
                    createdAt: new Date().toISOString(),
                });
                rootTxid = rootInscription.txid;
                console.log(`[inscribe] Identity root inscription: ${rootTxid}`);
            } catch (rootErr) {
                console.warn('[inscribe] Identity root inscription failed (using original txid):', rootErr);
            }

            const { data: identity, error: idError } = await supabaseAdmin
                .from('bit_sign_identities')
                .insert({
                    user_handle: handle,
                    token_id: rootTxid,
                    metadata: identityMetadata,
                })
                .select()
                .single();

            if (idError) throw idError;

            // Retroactively link existing vault items as strands
            try {
                await linkExistingVaultItems(identity.id, rootTxid, handle);
            } catch (linkErr) {
                console.warn('[inscribe] linkExistingVaultItems failed (non-fatal):', linkErr);
            }

            return NextResponse.json({ success: true, txid: rootTxid, identity });
        }

        // Determine storage mode
        const isPlaintext = !!plaintextData && !encryptedData;

        if (!plaintextData && !encryptedData) {
            return NextResponse.json({ error: 'Missing payload (plaintextData or encryptedData)' }, { status: 400 });
        }

        const { data: signature, error: sigError } = await supabaseAdmin
            .from('bit_sign_signatures')
            .insert({
                user_handle: handle,
                signature_type: signatureType,
                payload_hash: payloadHash,
                encrypted_payload: isPlaintext ? plaintextData : encryptedData,
                iv: isPlaintext ? null : iv,
                txid: txid,
                metadata: metadata || {},
                encryption_version: isPlaintext ? 0 : (encryption_version || 1),
            })
            .select()
            .single();

        if (sigError) throw sigError;

        // Auto-create strand if user has an identity
        try {
            const { data: existingIdentity } = await supabaseAdmin
                .from('bit_sign_identities')
                .select('id, token_id')
                .eq('user_handle', handle)
                .maybeSingle();

            if (existingIdentity && signature) {
                await createStrand({
                    identityId: existingIdentity.id,
                    rootTxid: existingIdentity.token_id,
                    strandType: 'vault_item',
                    strandSubtype: signatureType,
                    signatureId: signature.id,
                    label: metadata?.type || signatureType,
                    userHandle: handle,
                });
            }
        } catch (strandErr) {
            console.warn('[inscribe] Auto-strand creation failed (non-fatal):', strandErr);
        }

        return NextResponse.json({
            success: true,
            txid: txid,
            signature: signature,
            inscription: inscriptionResult ? {
                dataHash: inscriptionResult.dataHash,
                explorerUrl: inscriptionResult.blockchainExplorerUrl,
            } : null,
        });
    } catch (error: any) {
        console.error('Safe Box Inscription Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to inscribe attestation' }, { status: 500 });
    }
}
