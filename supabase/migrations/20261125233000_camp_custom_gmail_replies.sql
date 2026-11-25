-- A private, single-use bearer route per forwarded copy. Existing copies have no token.
alter table public.camp_rise_again_alias_delivery
  add column reply_token uuid unique,
  add column reply_expires_at timestamptz;
alter table public.camp_rise_again_alias_messages
  add column gmail_reply_token uuid unique,
  add column gmail_source_id text unique,
  add column sent_by text;
-- Existing service-only grants and RLS remain unchanged.
