-- Soft-delete: add deleted_at timestamp to signatures for trash bin
ALTER TABLE public.bit_sign_signatures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-deleted items
CREATE INDEX IF NOT EXISTS idx_signatures_deleted_at ON public.bit_sign_signatures (deleted_at) WHERE deleted_at IS NOT NULL;
