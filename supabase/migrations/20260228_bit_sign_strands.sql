-- bit_sign_strands: Identity strand attestations
-- Used by identity-strands.ts createStrand / getStrandsForIdentity / recalculateIdentityStrength

CREATE TABLE IF NOT EXISTS bit_sign_strands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES bit_sign_identities(id),
  root_txid TEXT,
  strand_type TEXT NOT NULL,
  strand_subtype TEXT,
  signature_id UUID REFERENCES bit_sign_signatures(id),
  provider_handle TEXT,
  provider_id TEXT,
  provider_metadata JSONB,
  strand_txid TEXT,
  label TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bss_identity ON bit_sign_strands(identity_id);
CREATE INDEX idx_bss_strand_type ON bit_sign_strands(strand_type);
CREATE INDEX idx_bss_root_txid ON bit_sign_strands(root_txid);
