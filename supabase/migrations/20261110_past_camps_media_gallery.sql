-- Camp Rise Again public albums with private, release-gated media.
-- A media file cannot be displayed until an authorized admin confirms publication consent.
create table if not exists public.camp_rise_again_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 150),
  camp_date date,
  location text not null default '' check (char_length(location)<=160),
  description text not null default '' check (char_length(description)<=1200),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.camp_rise_again_album_media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.camp_rise_again_albums(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('photo','video')),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime')),
  bytes bigint not null check (bytes > 0 and bytes <= 47185920),
  caption text not null default '' check (char_length(caption)<=700),
  alt_text text not null default '' check (char_length(alt_text)<=200),
  sort_order integer not null default 0,
  upload_complete boolean not null default false,
  consent_confirmed boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_requires_consent check (not is_published or (upload_complete and consent_confirmed)),
  constraint photo_requires_alt check (not (media_type='photo' and is_published) or char_length(btrim(alt_text))>=5)
);
create index if not exists camp_album_order_idx on public.camp_rise_again_albums(sort_order,created_at);
create index if not exists camp_album_media_order_idx on public.camp_rise_again_album_media(album_id,sort_order,created_at);
alter table public.camp_rise_again_albums enable row level security;
alter table public.camp_rise_again_album_media enable row level security;
revoke all on public.camp_rise_again_albums from public,anon,authenticated;
revoke all on public.camp_rise_again_album_media from public,anon,authenticated;
grant select,insert,update,delete on public.camp_rise_again_albums to service_role;
grant select,insert,update,delete on public.camp_rise_again_album_media to service_role;

-- Bucket is private; never enable public listing. Only the server creates signed
-- upload URLs and temporary read URLs for explicitly published media.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('camp-rise-again-past-camps','camp-rise-again-past-camps',false,47185920,
 array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[])
on conflict(id) do update set public=false,file_size_limit=47185920,
 allowed_mime_types=excluded.allowed_mime_types;

-- A draft scaffold for the camp already listed on the homepage. It won't
-- appear on the public site until a staff member approves and publishes it.
insert into public.camp_rise_again_albums(title,camp_date,location,description,sort_order,is_published)
select 'Fall Camp 2026','2026-11-06','Austin, Texas','Moments and memories from our fall gathering.',10,false
where not exists (select 1 from public.camp_rise_again_albums);
