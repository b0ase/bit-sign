-- Add dismissed flags to co_sign_requests so users can clean up their inbox/sent views
ALTER TABLE public.co_sign_requests ADD COLUMN IF NOT EXISTS sender_dismissed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.co_sign_requests ADD COLUMN IF NOT EXISTS recipient_dismissed BOOLEAN DEFAULT FALSE;
