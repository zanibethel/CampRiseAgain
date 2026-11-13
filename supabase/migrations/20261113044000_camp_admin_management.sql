-- Camp Rise Again: private, shared administrator directory.
-- No CreatorHub auth.users records or global GoTrue SMTP settings are changed.
-- Existing four Camp admins are retained, with the original site operator
-- protected against accidental removal.
create table if not exists public.camp_rise_again_admin_accounts (
  email text primary key,
  enabled boolean not null default true,
  is_protected boolean not null default false,
  added_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_invited_at timestamptz,
  revoked_at timestamptz,
  constraint camp_admin_email_valid check (email = lower(trim(email))
    and length(email) between 5 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
alter table public.camp_rise_again_admin_accounts enable row level security;
revoke all on public.camp_rise_again_admin_accounts from public, anon, authenticated;
grant select,insert,update,delete on public.camp_rise_again_admin_accounts to service_role;

insert into public.camp_rise_again_admin_accounts(email,enabled,is_protected,added_by)
values
 ('schofieldtierra@gmail.com',true,false,'initial migration'),
 ('zanibethel@gmail.com',true,true,'initial migration'),
 ('matthias.quellenberg@gmail.com',true,false,'initial migration'),
 ('james.campriseagain@gmail.com',true,false,'initial migration')
on conflict (email) do update
 set enabled=true, is_protected=excluded.is_protected,
     updated_at=now(), revoked_at=null;

-- Defense in depth: even privileged code cannot accidentally disable the
-- original recovery administrator. All other admins can help one another.
create or replace function private.camp_rise_again_admin_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog
as $$
begin
  if TG_OP='DELETE' then
    if old.email='zanibethel@gmail.com' then
      raise exception 'The primary recovery administrator cannot be removed';
    end if;
    return old;
  end if;
  if old.email='zanibethel@gmail.com' and
    (not new.enabled or not new.is_protected or new.email<>old.email) then
    raise exception 'The primary recovery administrator must remain enabled';
  end if;
  return new;
end;
$$;
revoke all on function private.camp_rise_again_admin_guard() from public,anon,authenticated;
drop trigger if exists camp_admin_guard on public.camp_rise_again_admin_accounts;
create trigger camp_admin_guard before update or delete
on public.camp_rise_again_admin_accounts
for each row execute function private.camp_rise_again_admin_guard();

create table if not exists public.camp_rise_again_admin_audit (
  id bigint generated always as identity primary key,
  action text not null check (action in ('add','restore','revoke','invite_sent')),
  actor_email text not null,
  target_email text not null,
  at timestamptz not null default now()
);
alter table public.camp_rise_again_admin_audit enable row level security;
revoke all on public.camp_rise_again_admin_audit from public,anon,authenticated;
grant select,insert on public.camp_rise_again_admin_audit to service_role;
grant usage,select on sequence public.camp_rise_again_admin_audit_id_seq to service_role;

-- Polices call this live confirmed-user check on every database operation.
-- Never rely on user_metadata or only on an old JWT email claim.
create or replace function private.camp_rise_again_is_admin()
returns boolean
language sql stable security definer
set search_path=pg_catalog
as $$
  select exists (
    select 1 from public.camp_rise_again_admin_accounts a
      join auth.users u on a.email=lower(u.email)
    where u.id=(select auth.uid())
      and u.email_confirmed_at is not null
      and a.enabled=true
  );
$$;
revoke all on function private.camp_rise_again_is_admin() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.camp_rise_again_is_admin() to authenticated;

-- Replace only Camp's known hard-coded 4-email policy predicates.
-- Keep all public read rules and all CreatorHub access rules unchanged.
do $camp_dynamic_admin$
declare
  item record;
  old_a text := $$lower((auth.jwt() ->> 'email'::text)) = ANY (ARRAY['schofieldtierra@gmail.com'::text, 'zanibethel@gmail.com'::text, 'matthias.quellenberg@gmail.com'::text, 'james.campriseagain@gmail.com'::text])$$;
  old_b text := $$lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text)) = ANY (ARRAY['schofieldtierra@gmail.com'::text, 'zanibethel@gmail.com'::text, 'matthias.quellenberg@gmail.com'::text, 'james.campriseagain@gmail.com'::text])$$;
  policy_qual text;
  policy_check text;
  clauses text;
  touched integer := 0;
  legacy integer;
begin
  select count(*) into legacy from pg_policies
  where ((schemaname='public' and tablename like 'camp_rise_again_%')
    or (schemaname='storage' and tablename='objects' and policyname like 'camp %'))
    and (coalesce(qual,'') like '%zanibethel@gmail.com%'
      or coalesce(with_check,'') like '%zanibethel@gmail.com%');
  if legacy <> 18 then
    raise exception 'Unexpected Camp policy count %, expected 18',legacy;
  end if;
  for item in
    select schemaname,tablename,policyname,qual,with_check
    from pg_policies where
      ((schemaname='public' and tablename like 'camp_rise_again_%')
        or (schemaname='storage' and tablename='objects' and policyname like 'camp %'))
      and (coalesce(qual,'') like '%zanibethel@gmail.com%'
        or coalesce(with_check,'') like '%zanibethel@gmail.com%')
  loop
    policy_qual:=replace(replace(coalesce(item.qual,''),old_a,'(select private.camp_rise_again_is_admin())'),old_b,'(select private.camp_rise_again_is_admin())');
    policy_check:=replace(replace(coalesce(item.with_check,''),old_a,'(select private.camp_rise_again_is_admin())'),old_b,'(select private.camp_rise_again_is_admin())');
    if policy_qual like '%zanibethel@gmail.com%' or policy_check like '%zanibethel@gmail.com%' then
      raise exception 'Unexpected condition in policy %',item.policyname;
    end if;
    clauses:='';
    if item.qual is not null then clauses:=clauses||' USING ('||policy_qual||')';end if;
    if item.with_check is not null then clauses:=clauses||' WITH CHECK ('||policy_check||')';end if;
    execute format('ALTER POLICY %I ON %I.%I%s',item.policyname,item.schemaname,item.tablename,clauses);
    touched:=touched+1;
  end loop;
  if touched <> 18 then raise exception 'Expected 18 policies, updated %',touched; end if;
end
$camp_dynamic_admin$;

-- Public visitors must never be required to execute the private admin
-- predicate. Keep the public-visible rows in the public policy, and grant
-- private hidden-row visibility via a separate authenticated-only policy.
alter policy "camp team public read"
on public.camp_rise_again_team_members
using (is_visible = true);
create policy "camp team authenticated admin read hidden"
on public.camp_rise_again_team_members
for select to authenticated
using ((select private.camp_rise_again_is_admin()));
