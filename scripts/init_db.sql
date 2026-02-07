
-- Create bit_sign_identities table
CREATE TABLE IF NOT EXISTS public.bit_sign_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_handle TEXT NOT NULL UNIQUE,
    github_handle TEXT,
    github_id TEXT,
    github_metadata JSONB,
    token_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create bit_sign_signatures table
CREATE TABLE IF NOT EXISTS public.bit_sign_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_handle TEXT NOT NULL,
    signature_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    iv TEXT NOT NULL,
    txid TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bit_sign_identities_handle ON public.bit_sign_identities(user_handle);
CREATE INDEX IF NOT EXISTS idx_bit_sign_identities_github ON public.bit_sign_identities(github_handle);
CREATE INDEX IF NOT EXISTS idx_bit_sign_signatures_handle ON public.bit_sign_signatures(user_handle);

-- Enable Row Level Security (RLS)
ALTER TABLE public.bit_sign_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bit_sign_signatures ENABLE ROW LEVEL SECURITY;

-- Create policies (Open for now as we use Service Role specific logic in API, but good practice to have)
-- Allow public read access
CREATE POLICY "Allow public read access" ON public.bit_sign_identities FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.bit_sign_signatures FOR SELECT USING (true);

-- Allow service role full access (implicit, but explicit for clarity if needed, though RLS bypasses for service role)
