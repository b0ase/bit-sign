/**
 * Identity Strand utilities for bit-sign
 *
 * Manages the tree of identity strands attached to a root identity token.
 * Each strand represents an attestation (vault item, OAuth link, signature, etc.)
 * The DB is a fast index; strand_txid references the on-chain inscription (source of truth).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { inscribeBitSignData } from '@/lib/bsv-inscription';
import type { BitSignInscriptionData } from '@/lib/bsv-inscription';

// ---------- Strand point values ----------
// Identity levels are gated by strand types, not just score:
//   Lv.1 Basic     — OAuth only (can be botted)
//   Lv.2 Verified  — Self-attested (name+address form) OR ID docs (selfie/video/passport)
//   Lv.3 Strong    — Paid signing via HandCash OR peer-verified (co-signed legal docs)
//   Lv.4 Sovereign — Third-party KYC (Veriff)

const STRAND_POINTS: Record<string, number> = {
  'TLDRAW': 1,
  'CAMERA': 1,
  'VIDEO': 2,
  'DOCUMENT': 1,
  'SEALED_DOCUMENT': 2,
  'oauth/github': 2,
  'oauth/google': 2,
  'oauth/twitter': 1,
  'oauth/discord': 1,
  'oauth/linkedin': 2,
  'oauth/microsoft': 1,
  'registered_signature': 3,
  'profile_photo': 1,
  'id_document/passport': 5,
  'id_document/driving_licence': 5,
  'id_document/proof_of_address': 5,
  'self_attestation': 3,
  'paid_signing': 3,
  'peer_attestation/cosign': 5,
  'kyc/veriff': 10,
};

function strandKey(type: string, subtype?: string | null): string {
  if (subtype) return `${type}/${subtype}`;
  return type;
}

// ---------- Strength calculation ----------

export function getIdentityStrength(score: number, strandTypes?: string[]): { level: number; label: string } {
  const types = strandTypes || [];
  const hasKyc = types.includes('kyc/veriff');
  const hasPeerAttestation = types.some(t => t.startsWith('peer_attestation/'));
  const hasIdDocs = types.some(t =>
    t.startsWith('id_document/') || t === 'CAMERA' || t === 'VIDEO'
  );
  const hasPaidSigning = types.includes('paid_signing');
  const hasSelfAttestation = types.includes('self_attestation');

  // Lv.4 Sovereign: Third-party KYC (Veriff) — can't be gamed
  if (hasKyc) return { level: 4, label: 'Sovereign' };
  // Lv.3 Strong: Paid signing (costs money = stops bots) OR peer-verified co-sign
  if (hasPaidSigning || hasPeerAttestation) return { level: 3, label: 'Strong' };
  // Lv.2 Verified: Self-attested name+address, ID docs, selfies, videos
  if (hasIdDocs || hasSelfAttestation) return { level: 2, label: 'Verified' };
  // Lv.1 Basic: OAuth strands only (can be botted)
  return { level: 1, label: 'Basic' };
}

export async function recalculateIdentityStrength(identityId: string): Promise<number> {
  const { data: strands } = await supabaseAdmin
    .from('bit_sign_strands')
    .select('strand_type, strand_subtype')
    .eq('identity_id', identityId);

  if (!strands || strands.length === 0) {
    await supabaseAdmin
      .from('bit_sign_identities')
      .update({ identity_strength: 0 })
      .eq('id', identityId);
    return 0;
  }

  let score = 0;
  const strandTypes: string[] = [];
  for (const s of strands) {
    const key = strandKey(s.strand_type, s.strand_subtype);
    strandTypes.push(key);
    score += STRAND_POINTS[key] || 1;
  }

  await supabaseAdmin
    .from('bit_sign_identities')
    .update({ identity_strength: score })
    .eq('id', identityId);

  return score;
}

// ---------- Create a strand ----------

interface CreateStrandParams {
  identityId: string;
  rootTxid: string;
  strandType: string;
  strandSubtype?: string;
  signatureId?: string;
  providerHandle?: string;
  providerId?: string;
  providerMetadata?: Record<string, any>;
  label?: string;
  metadata?: Record<string, any>;
  userHandle?: string;
}

export async function createStrand(params: CreateStrandParams): Promise<{ id: string; strand_txid?: string }> {
  // Attempt on-chain inscription (fail gracefully)
  let strandTxid: string | undefined;
  try {
    const inscriptionData: BitSignInscriptionData = {
      type: 'identity_strand',
      userHandle: params.userHandle,
      rootTxid: params.rootTxid,
      strandType: params.strandType,
      strandSubtype: params.strandSubtype,
      strandLabel: params.label,
    };
    const result = await inscribeBitSignData(inscriptionData);
    strandTxid = result.txid;
    console.log(`[strand] On-chain inscription: ${strandTxid}`);
  } catch (err) {
    console.warn('[strand] On-chain inscription failed (non-fatal):', err);
  }

  const { data: strand, error } = await supabaseAdmin
    .from('bit_sign_strands')
    .insert({
      identity_id: params.identityId,
      root_txid: params.rootTxid,
      strand_type: params.strandType,
      strand_subtype: params.strandSubtype || null,
      signature_id: params.signatureId || null,
      provider_handle: params.providerHandle || null,
      provider_id: params.providerId || null,
      provider_metadata: params.providerMetadata || null,
      strand_txid: strandTxid || null,
      label: params.label || null,
      metadata: params.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[strand] DB insert error:', error);
    throw error;
  }

  // Recalculate strength
  await recalculateIdentityStrength(params.identityId);

  return { id: strand.id, strand_txid: strandTxid };
}

// ---------- Link existing vault items as strands ----------

export async function linkExistingVaultItems(identityId: string, rootTxid: string, userHandle: string) {
  // 1. Get all existing vault items for this user
  const { data: signatures } = await supabaseAdmin
    .from('bit_sign_signatures')
    .select('id, signature_type, txid, metadata')
    .eq('user_handle', userHandle);

  if (!signatures) return;

  // 2. Get identity record for GitHub/registered sig info
  const { data: identity } = await supabaseAdmin
    .from('bit_sign_identities')
    .select('github_handle, github_id, github_metadata, registered_signature_id, registered_signature_txid, avatar_url')
    .eq('id', identityId)
    .single();

  // 3. Create strands for each vault item
  for (const sig of signatures) {
    const type = sig.signature_type;
    if (['TLDRAW', 'CAMERA', 'VIDEO', 'DOCUMENT', 'SEALED_DOCUMENT'].includes(type)) {
      try {
        await createStrand({
          identityId,
          rootTxid,
          strandType: 'vault_item',
          strandSubtype: type,
          signatureId: sig.id,
          label: sig.metadata?.type || type,
          userHandle,
        });
      } catch (err) {
        console.warn(`[strand] Failed to link vault item ${sig.id}:`, err);
      }
    }
  }

  // 4. GitHub strand
  if (identity?.github_handle) {
    try {
      await createStrand({
        identityId,
        rootTxid,
        strandType: 'oauth',
        strandSubtype: 'github',
        providerHandle: identity.github_handle,
        providerId: identity.github_id || undefined,
        label: `GitHub @${identity.github_handle}`,
        userHandle,
      });
    } catch (err) {
      console.warn('[strand] Failed to link GitHub:', err);
    }
  }

  // 5. Registered signature strand
  if (identity?.registered_signature_id) {
    try {
      await createStrand({
        identityId,
        rootTxid,
        strandType: 'registered_signature',
        signatureId: identity.registered_signature_id,
        label: 'Registered Signature',
        metadata: { txid: identity.registered_signature_txid },
        userHandle,
      });
    } catch (err) {
      console.warn('[strand] Failed to link registered signature:', err);
    }
  }

  // 6. Profile photo strand
  if (identity?.avatar_url) {
    try {
      await createStrand({
        identityId,
        rootTxid,
        strandType: 'profile_photo',
        label: 'Profile Photo',
        userHandle,
      });
    } catch (err) {
      console.warn('[strand] Failed to link profile photo:', err);
    }
  }
}

// ---------- Get strands for an identity ----------

export async function getStrandsForIdentity(identityId: string) {
  const { data: strands } = await supabaseAdmin
    .from('bit_sign_strands')
    .select('*')
    .eq('identity_id', identityId)
    .order('created_at', { ascending: true });

  return strands || [];
}
