import { NextRequest, NextResponse } from 'next/server';
import { getUserAccount } from '@/lib/handcash';
import { supabaseAdmin } from '@/lib/supabase';
import { hashData } from '@/lib/bsv-inscription';
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

        // Inscribe on-chain via user's HandCash wallet
        let txid: string;

        try {
            const inscriptionData = {
                protocol: 'b0ase-bitsign',
                version: '1.0',
                type: 'signature_registration',
                signatureHash: payloadHash,
                signatureType: signatureType === 'TLDRAW' ? 'drawn' : 'typed',
                ownerName: handle,
                walletType: 'handcash',
                createdAt: new Date().toISOString(),
            };

            const paymentResult = await userAccount.wallet.pay({
                description: `BitSign: Register ${signatureType === 'TLDRAW' ? 'signature' : signatureType.toLowerCase()}`,
                appAction: 'inscribe',
                payments: [
                    { destination: handle, currencyCode: 'BSV', sendAmount: 0.00001 },
                ],
                attachment: { format: 'json', value: inscriptionData },
            });

            txid = paymentResult.transactionId;
            console.log(`[inscribe] On-chain via HandCash: ${txid}`);
        } catch (inscribeError: any) {
            console.warn('[inscribe] HandCash inscription failed:', inscribeError?.message || inscribeError);
            txid = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        }

        // Handle Identity Minting
        if (signatureType === 'IDENTITY_MINT') {
            // Use $HANDLE symbol (not $HANDLE-DNA)
            const tokenSymbol = `$${handle.toUpperCase()}`;
            const identityMetadata = { ...metadata, symbol: tokenSymbol };

            // Check if this handle already has a path402_identity_tokens record
            let path401TokenId: string | null = null;
            try {
                const { data: existingToken } = await supabaseAdmin
                    .from('path402_identity_tokens')
                    .select('id, token_id')
                    .eq('symbol', tokenSymbol)
                    .maybeSingle();
                if (existingToken) {
                    path401TokenId = existingToken.id;
                    console.log(`[inscribe] Found existing path401 token: ${path401TokenId}`);
                }
            } catch (lookupErr) {
                console.warn('[inscribe] path401 token lookup failed (non-fatal):', lookupErr);
            }

            // Inscribe identity_root on-chain via HandCash
            let rootTxid = txid;
            try {
                const rootData = {
                    p: '401',
                    op: 'root',
                    v: '1.0',
                    handle,
                    symbol: tokenSymbol,
                    payloadHash,
                    ts: new Date().toISOString(),
                };

                const rootPayment = await userAccount.wallet.pay({
                    description: `BitSign: Mint identity $${handle.toUpperCase()}`,
                    appAction: 'identity-root',
                    payments: [
                        { destination: handle, currencyCode: 'BSV', sendAmount: 0.00001 },
                    ],
                    attachment: { format: 'json', value: rootData },
                });
                rootTxid = rootPayment.transactionId;
                console.log(`[inscribe] Identity root via HandCash: ${rootTxid}`);
            } catch (rootErr: any) {
                console.warn('[inscribe] Identity root inscription failed (using original txid):', rootErr?.message || rootErr);
            }

            // Write to bit_sign_identities (primary)
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

            // Dual-write: also create/link path402_identity_tokens record
            if (!path401TokenId) {
                try {
                    const tokenId = await hashData(`path402:${tokenSymbol}:bitsign`);
                    const { data: newToken } = await supabaseAdmin
                        .from('path402_identity_tokens')
                        .insert({
                            holder_id: identity.id, // Will be overwritten if holder exists
                            symbol: tokenSymbol,
                            token_id: tokenId,
                            broadcast_txid: rootTxid.startsWith('pending-') ? null : rootTxid,
                            broadcast_status: rootTxid.startsWith('pending-') ? 'local' : 'confirmed',
                            source: 'bitsign',
                            inscription_data: { p: '401', op: 'root', v: '1.0', handle, symbol: tokenSymbol },
                        })
                        .select('id')
                        .maybeSingle();
                    if (newToken) {
                        path401TokenId = newToken.id;
                        console.log(`[inscribe] Created path401 token: ${path401TokenId}`);
                    }
                } catch (tokenErr) {
                    // May fail if symbol already taken — non-fatal for bit-sign flow
                    console.warn('[inscribe] path401 token creation failed (non-fatal):', tokenErr);
                }
            }

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
            inscription: txid && !txid.startsWith('pending-') ? {
                transactionId: txid,
                explorerUrl: `https://whatsonchain.com/tx/${txid}`,
            } : null,
        });
    } catch (error: any) {
        console.error('Safe Box Inscription Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to inscribe attestation' }, { status: 500 });
    }
}
