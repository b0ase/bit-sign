-- peer_attestation_requests: Two-party attestation flow
-- Used by /api/bitsign/peer-attest route (request + respond actions)

CREATE TABLE IF NOT EXISTS peer_attestation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_handle TEXT NOT NULL,
  attestor_handle TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'rejected', 'expired')),
  declaration TEXT,
  attested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_par_requester ON peer_attestation_requests(requester_handle);
CREATE INDEX idx_par_attestor ON peer_attestation_requests(attestor_handle);
CREATE INDEX idx_par_status ON peer_attestation_requests(status);
