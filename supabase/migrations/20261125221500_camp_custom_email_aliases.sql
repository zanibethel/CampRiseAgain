-- Custom mailboxes are separate from native Resend inboxes.
-- Service-role only. The Camp bridge enforces verified admin membership and mailbox ACLs.
create table public.camp_rise_again_mail_aliases (
  local_part text primary key check (local_part ~ '^[a-z][a-z0-9._-]{0,47}$' and local_part not in ('info','volunteer','forms','support','postmaster','abuse','mailer-daemon') and local_part not like 'reply-%'),
  label text not null check (length(label) between 1 and 100),
  enabled boolean not null default true,
  access_emails text[] not null check (cardinality(access_emails) between 1 and 30),
  forwarder_ids uuid[] not null default '{}' check (cardinality(forwarder_ids) <= 30),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.camp_rise_again_alias_messages (
  id uuid primary key default gen_random_uuid(),
  alias text not null references public.camp_rise_again_mail_aliases(local_part) on delete restrict,
  direction text not null check (direction in ('inbound','outbound')),
  provider_id text,
  request_id uuid,
  reply_to_id uuid references public.camp_rise_again_alias_messages(id) on delete restrict,
  from_email text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  attachment_names text[] not null default '{}',
  message_id text,
  state text not null check (state in ('received','pending','sent','uncertain')),
  read_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique(alias,provider_id),
  unique(alias,request_id)
);
create index camp_alias_messages_list_idx on public.camp_rise_again_alias_messages(alias,created_at desc);
create table public.camp_rise_again_alias_delivery (
  message_id uuid not null references public.camp_rise_again_alias_messages(id) on delete restrict,
  forwarder_id uuid not null,
  state text not null check (state in ('pending','sent','uncertain')),
  updated_at timestamptz not null default now(),
  primary key(message_id,forwarder_id)
);
alter table public.camp_rise_again_mail_aliases enable row level security;
alter table public.camp_rise_again_alias_messages enable row level security;
alter table public.camp_rise_again_alias_delivery enable row level security;
revoke all on public.camp_rise_again_mail_aliases,public.camp_rise_again_alias_messages,public.camp_rise_again_alias_delivery from public,anon,authenticated;
grant select,insert,update,delete on public.camp_rise_again_mail_aliases,public.camp_rise_again_alias_messages,public.camp_rise_again_alias_delivery to service_role;
