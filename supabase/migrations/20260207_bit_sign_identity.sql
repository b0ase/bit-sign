-- Tables for Bit-Sign Sovereign Identity and Signature Chains

-- Identity tokens (Digital DNA)
CREATE TABLE IF NOT EXISTS bit_sign_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_handle TEXT NOT NULL REFERENCES unified_users(display_name), -- Linking via display_name which is our HandCash handle
    token_id TEXT UNIQUE, -- BSV21 Token ID
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signature Chain (Attestations)
CREATE TABLE IF NOT EXISTS bit_sign_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_handle TEXT NOT NULL,
    signature_type TEXT NOT NULL, -- 'TLDRAW', 'DOCUMENT', 'MESSAGE'
    payload_hash TEXT NOT NULL, -- SHA-256 of original content
    encrypted_payload TEXT NOT NULL, -- Client-side encrypted content (Base64)
    iv TEXT NOT NULL, -- Initialisation Vector (Base64)
    txid TEXT UNIQUE, -- Bitcoin transaction ID (Inscription)
    identity_token_id TEXT, -- Link to the user's identity token
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_bit_sign_signatures_user_handle ON bit_sign_signatures(user_handle);
CREATE INDEX IF NOT EXISTS idx_bit_sign_signatures_type ON bit_sign_signatures(signature_type);
