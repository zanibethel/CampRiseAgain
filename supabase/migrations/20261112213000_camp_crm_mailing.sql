-- Camp Rise Again CRM + opt-in mailing foundation.
-- The public storefront never receives direct Data API access to these tables.
create table if not exists public.camp_rise_again_crm_contacts (
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 5 and 254),
  display_name text not null default '',
  phone text not null default '',
  source_kinds text[] not null default '{}',
  stage text not null default 'new' check (stage in ('new','follow_up','active','alumni','archived')),
  tags text[] not null default '{}',
  notes text not null default '',
  last_engaged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists camp_crm_contacts_recent_idx
  on public.camp_rise_again_crm_contacts(last_engaged_at desc nulls last);

create table if not exists public.camp_rise_again_crm_activity (
  id bigint generated always as identity primary key,
  contact_email text not null references public.camp_rise_again_crm_contacts(email) on update cascade,
  source_kind text not null check (source_kind in ('camper','volunteer','contact')),
  source_id uuid not null,
  created_at timestamptz not null,
  unique(source_kind, source_id)
);
create index if not exists camp_crm_activity_contact_idx
  on public.camp_rise_again_crm_activity(contact_email,created_at desc);

create table if not exists public.camp_rise_again_mailing_subscribers (
  email text primary key references public.camp_rise_again_crm_contacts(email) on update cascade,
  status text not null default 'pending' check (status in ('pending','subscribed','unsubscribed')),
  verification_hash text,
  verification_sent_at timestamptz,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  source text not null default 'newsletter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camp_mailing_hash_format check (verification_hash is null or verification_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists camp_mailing_status_idx on public.camp_rise_again_mailing_subscribers(status);

create table if not exists public.camp_rise_again_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'announcement' check (kind in ('announcement','newsletter')),
  subject text not null check (char_length(subject) between 3 and 150),
  body text not null check (char_length(body) between 10 and 12000),
  status text not null default 'draft' check (status in ('draft','sending','sent')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.camp_rise_again_campaign_deliveries (
  campaign_id uuid not null references public.camp_rise_again_campaigns(id) on delete cascade,
  email text not null references public.camp_rise_again_crm_contacts(email),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  error_code text,
  primary key(campaign_id,email)
);
create index if not exists camp_campaign_deliveries_idx
  on public.camp_rise_again_campaign_deliveries(campaign_id,status,claimed_at);

-- Existing applications become distinct contacts; never copy free-text answers,
-- birthdays, addresses or any health-related intake details into CRM.
insert into public.camp_rise_again_crm_contacts
 (email,display_name,phone,source_kinds,last_engaged_at)
select e, max(n), max(p), array_agg(distinct k), max(at)
from (
 select lower(btrim(email)) e,
   btrim(concat_ws(' ',first_name,last_name)) n,
   coalesce(phone,'') p, 'camper' k, created_at at
 from public.camp_rise_again_camper_applications
 union all
 select lower(btrim(email)),
   btrim(concat_ws(' ',first_name,last_name)),
   coalesce(phone,''),'volunteer',created_at
 from public.camp_rise_again_volunteer_applications
 union all
 select lower(btrim(email)),coalesce(name,''),coalesce(phone,''),
   'contact',created_at from public.camp_rise_again_contact_messages
) s
where e ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' and char_length(e)<=254
group by e
on conflict(email) do update set
 display_name=case when public.camp_rise_again_crm_contacts.display_name=''
   then excluded.display_name else public.camp_rise_again_crm_contacts.display_name end,
 phone=case when public.camp_rise_again_crm_contacts.phone=''
   then excluded.phone else public.camp_rise_again_crm_contacts.phone end,
 source_kinds=(select array_agg(distinct x) from unnest(
   public.camp_rise_again_crm_contacts.source_kinds || excluded.source_kinds) x),
 last_engaged_at=greatest(public.camp_rise_again_crm_contacts.last_engaged_at, excluded.last_engaged_at),
 updated_at=now();

insert into public.camp_rise_again_crm_activity(contact_email,source_kind,source_id,created_at)
select lower(btrim(email)),'camper',id,created_at from public.camp_rise_again_camper_applications
where lower(btrim(email)) in (select email from public.camp_rise_again_crm_contacts)
union all
select lower(btrim(email)),'volunteer',id,created_at from public.camp_rise_again_volunteer_applications
where lower(btrim(email)) in (select email from public.camp_rise_again_crm_contacts)
union all
select lower(btrim(email)),'contact',id,created_at from public.camp_rise_again_contact_messages
where lower(btrim(email)) in (select email from public.camp_rise_again_crm_contacts)
on conflict(source_kind,source_id) do nothing;

-- Invoker runs as the private service role used by existing form submissions.
create or replace function public.camp_rise_again_capture_crm()
returns trigger language plpgsql security invoker set search_path=public
as $fn$
declare
  normalized text := lower(btrim(new.email));
  display text;
  source text;
begin
  if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
    or char_length(normalized)>254 then return new; end if;
  source := case tg_table_name
    when 'camp_rise_again_camper_applications' then 'camper'
    when 'camp_rise_again_volunteer_applications' then 'volunteer'
    else 'contact' end;
  if source='contact' then display := coalesce(new.name,'');
  else display := btrim(concat_ws(' ',new.first_name,new.last_name)); end if;
  insert into public.camp_rise_again_crm_contacts
    (email,display_name,phone,source_kinds,last_engaged_at)
  values (normalized,left(display,160),left(coalesce(new.phone,''),40),array[source],new.created_at)
  on conflict(email) do update set
    display_name=case when public.camp_rise_again_crm_contacts.display_name=''
      then excluded.display_name else public.camp_rise_again_crm_contacts.display_name end,
    phone=case when public.camp_rise_again_crm_contacts.phone=''
      then excluded.phone else public.camp_rise_again_crm_contacts.phone end,
    source_kinds=(select array_agg(distinct x) from unnest(
      public.camp_rise_again_crm_contacts.source_kinds || excluded.source_kinds) x),
    last_engaged_at=greatest(public.camp_rise_again_crm_contacts.last_engaged_at,excluded.last_engaged_at),
    updated_at=now();
  insert into public.camp_rise_again_crm_activity(contact_email,source_kind,source_id,created_at)
  values(normalized,source,new.id,new.created_at)
  on conflict(source_kind,source_id) do nothing;
  return new;
end;
$fn$;
drop trigger if exists camp_capture_camper_crm on public.camp_rise_again_camper_applications;
create trigger camp_capture_camper_crm after insert
on public.camp_rise_again_camper_applications for each row execute function public.camp_rise_again_capture_crm();
drop trigger if exists camp_capture_volunteer_crm on public.camp_rise_again_volunteer_applications;
create trigger camp_capture_volunteer_crm after insert
on public.camp_rise_again_volunteer_applications for each row execute function public.camp_rise_again_capture_crm();
drop trigger if exists camp_capture_contact_crm on public.camp_rise_again_contact_messages;
create trigger camp_capture_contact_crm after insert
on public.camp_rise_again_contact_messages for each row execute function public.camp_rise_again_capture_crm();

-- The lease stops concurrent clicks from sending the same delivery twice.
create or replace function public.camp_rise_again_claim_campaign_batch(
  p_campaign_id uuid, p_limit integer default 10
) returns table(recipient_email text)
language sql security invoker set search_path=public
as $fn$
  with available as (
    select d.email from public.camp_rise_again_campaign_deliveries d
    join public.camp_rise_again_mailing_subscribers s on s.email=d.email
    join public.camp_rise_again_campaigns c on c.id=d.campaign_id
    where d.campaign_id=p_campaign_id and c.status='sending'
      and s.status='subscribed'
      and (d.status='pending' or
        (d.status='sending' and d.claimed_at < now()-interval '10 minutes'))
    order by d.email
    for update of d skip locked
    limit least(greatest(coalesce(p_limit,10),1),20)
  ), claimed as (
    update public.camp_rise_again_campaign_deliveries d
    set status='sending',claimed_at=now()
    from available a where d.campaign_id=p_campaign_id and d.email=a.email
    returning d.email
  )
  select email from claimed;
$fn$;

-- Explicit RLS and no public/authenticated table or helper execution access.
alter table public.camp_rise_again_crm_contacts enable row level security;
alter table public.camp_rise_again_crm_activity enable row level security;
alter table public.camp_rise_again_mailing_subscribers enable row level security;
alter table public.camp_rise_again_campaigns enable row level security;
alter table public.camp_rise_again_campaign_deliveries enable row level security;
revoke all on table public.camp_rise_again_crm_contacts,
 public.camp_rise_again_crm_activity,public.camp_rise_again_mailing_subscribers,
 public.camp_rise_again_campaigns,public.camp_rise_again_campaign_deliveries
 from public,anon,authenticated;
grant select,insert,update,delete on table public.camp_rise_again_crm_contacts,
 public.camp_rise_again_crm_activity,public.camp_rise_again_mailing_subscribers,
 public.camp_rise_again_campaigns,public.camp_rise_again_campaign_deliveries to service_role;
revoke all on function public.camp_rise_again_capture_crm() from public,anon,authenticated;
revoke all on function public.camp_rise_again_claim_campaign_batch(uuid,integer) from public,anon,authenticated;
grant execute on function public.camp_rise_again_claim_campaign_batch(uuid,integer) to service_role;
grant usage,select on sequence public.camp_rise_again_crm_activity_id_seq to service_role;
