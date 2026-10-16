-- Gallery photos for Our Story, separate from the main memorial portrait.
-- Image binary data remains in the existing camp-rise-again-branding storage bucket.
create table if not exists public.camp_rise_again_memorial_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (storage_path like 'memorial-gallery/%'),
  caption text not null default '',
  placement text not null default 'after-personal' check (
    placement in ('after-intro', 'after-personal', 'after-founder', 'after-legacy', 'after-honors')
  ),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists camp_memorial_photos_order_idx
  on public.camp_rise_again_memorial_photos (placement, sort_order, created_at);

alter table public.camp_rise_again_memorial_photos enable row level security;

create policy "camp memorial public gallery"
  on public.camp_rise_again_memorial_photos
  for select to anon, authenticated
  using (is_visible);

create policy "camp memorial admins view all"
  on public.camp_rise_again_memorial_photos
  for select to authenticated
  using (
    lower(coalesce((select auth.jwt()->>'email'), '')) =
      any(array['schofieldtierra@gmail.com', 'zanibethel@gmail.com'])
  );

create policy "camp memorial admins add"
  on public.camp_rise_again_memorial_photos
  for insert to authenticated
  with check (
    lower(coalesce((select auth.jwt()->>'email'), '')) =
      any(array['schofieldtierra@gmail.com', 'zanibethel@gmail.com'])
  );

create policy "camp memorial admins edit"
  on public.camp_rise_again_memorial_photos
  for update to authenticated
  using (
    lower(coalesce((select auth.jwt()->>'email'), '')) =
      any(array['schofieldtierra@gmail.com', 'zanibethel@gmail.com'])
  )
  with check (
    lower(coalesce((select auth.jwt()->>'email'), '')) =
      any(array['schofieldtierra@gmail.com', 'zanibethel@gmail.com'])
  );

create policy "camp memorial admins remove"
  on public.camp_rise_again_memorial_photos
  for delete to authenticated
  using (
    lower(coalesce((select auth.jwt()->>'email'), '')) =
      any(array['schofieldtierra@gmail.com', 'zanibethel@gmail.com'])
  );

grant select on public.camp_rise_again_memorial_photos to anon, authenticated;
grant insert, update, delete on public.camp_rise_again_memorial_photos to authenticated;
