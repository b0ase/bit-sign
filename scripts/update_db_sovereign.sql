
-- Add encrypted_auth_token to bit_sign_identities
-- This allows the server to act as the USER (Sovereign) during offline webhook events
-- without requiring a centralized "House" wallet.

ALTER TABLE public.bit_sign_identities 
ADD COLUMN IF NOT EXISTS encrypted_auth_token TEXT;
