alter table public.camp_rise_again_site_settings
  add column if not exists home_section_order jsonb not null default '["announcement","hero","about","schedule","team","keep-going","donate","contact"]'::jsonb,
  add column if not exists logo_path text not null default '';

insert into storage.buckets (id, name, public)
values ('camp-rise-again-branding', 'camp-rise-again-branding', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='camp branding admin upload'
  ) then
    create policy "camp branding admin upload"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'camp-rise-again-branding'
      and lower(coalesce((select auth.jwt()->>'email'), ''))
        = any(array['schofieldtierra@gmail.com','zanibethel@gmail.com'])
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='camp branding admin update'
  ) then
    create policy "camp branding admin update"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'camp-rise-again-branding'
      and lower(coalesce((select auth.jwt()->>'email'), ''))
        = any(array['schofieldtierra@gmail.com','zanibethel@gmail.com'])
    )
    with check (
      bucket_id = 'camp-rise-again-branding'
      and lower(coalesce((select auth.jwt()->>'email'), ''))
        = any(array['schofieldtierra@gmail.com','zanibethel@gmail.com'])
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='camp branding admin delete'
  ) then
    create policy "camp branding admin delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'camp-rise-again-branding'
      and lower(coalesce((select auth.jwt()->>'email'), ''))
        = any(array['schofieldtierra@gmail.com','zanibethel@gmail.com'])
    );
  end if;
end $$;
