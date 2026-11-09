-- Camp Rise Again mail forwarding and Gmail reply relay.
-- Service-role only: never expose to public/anon/authenticated Data API callers.
create table if not exists public.camp_rise_again_email_forwarders (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  title text not null default '',
  inboxes text[] not null default array['info','volunteer','forms']::text[],
  enabled boolean not null default false,
  verified_at timestamptz,
  verification_token_hash text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_forwarder_valid_email check (email = lower(email) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint email_forwarder_valid_inboxes check (inboxes <@ array['info','volunteer','forms']::text[])
);

create table if not exists public.camp_rise_again_mail_reply_routes (
  id uuid primary key default gen_random_uuid(),
  inbound_email_id text not null,
  forwarder_id uuid not null references public.camp_rise_again_email_forwarders(id) on delete cascade,
  inbox_address text not null check (inbox_address in ('info@campriseagain.org','volunteer@campriseagain.org','forms@campriseagain.org')),
  original_sender text not null,
  original_subject text not null,
  original_message_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  unique (inbound_email_id, forwarder_id, inbox_address)
);
create index if not exists camp_mail_routes_expiration_idx on public.camp_rise_again_mail_reply_routes(expires_at);

create table if not exists public.camp_rise_again_mail_events (
  event_key text primary key,
  delivered_at timestamptz not null default now()
);

alter table public.camp_rise_again_email_forwarders enable row level security;
alter table public.camp_rise_again_mail_reply_routes enable row level security;
alter table public.camp_rise_again_mail_events enable row level security;

revoke all on public.camp_rise_again_email_forwarders from anon, authenticated;
revoke all on public.camp_rise_again_mail_reply_routes from anon, authenticated;
revoke all on public.camp_rise_again_mail_events from anon, authenticated;

-- Explicitly authorized existing Camp Rise Again founder.
insert into public.camp_rise_again_email_forwarders
  (email, display_name, title, inboxes, enabled, verified_at)
values ('schofieldtierra@gmail.com', 'Tierra Schofield', 'Founder of CampRiseAgain',
        array['info','volunteer','forms']::text[], true, now())
on conflict (email) do nothing;
