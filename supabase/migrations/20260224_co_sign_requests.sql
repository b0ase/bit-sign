-- Co-sign requests table for two-party document signing flow
CREATE TABLE IF NOT EXISTS public.co_sign_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    sender_handle TEXT NOT NULL,
    recipient_handle TEXT,
    recipient_email TEXT,
    claim_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
    status TEXT DEFAULT 'pending',
    response_document_id UUID,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    signed_at TIMESTAMPTZ,
    notified_sender BOOLEAN DEFAULT false
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_co_sign_requests_sender ON public.co_sign_requests(sender_handle);
CREATE INDEX IF NOT EXISTS idx_co_sign_requests_recipient ON public.co_sign_requests(recipient_handle);
CREATE INDEX IF NOT EXISTS idx_co_sign_requests_document ON public.co_sign_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_co_sign_requests_claim_token ON public.co_sign_requests(claim_token);
CREATE INDEX IF NOT EXISTS idx_co_sign_requests_status ON public.co_sign_requests(status);

-- Enable RLS
ALTER TABLE public.co_sign_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read (API uses service role for actual access control)
CREATE POLICY "Allow public read access" ON public.co_sign_requests FOR SELECT USING (true);
