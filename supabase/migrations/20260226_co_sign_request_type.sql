-- Add request_type column to distinguish co-sign vs witness requests
ALTER TABLE public.co_sign_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'co-sign';

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_co_sign_requests_type ON public.co_sign_requests(request_type);
