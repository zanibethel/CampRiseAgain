create extension if not exists pgcrypto;

create table if not exists public.camper_applications (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), first_name text not null, last_name text not null, email text not null, phone text not null, address_1 text not null, address_2 text, city text not null, state text not null, postal_code text not null, date_of_birth date not null, shirt_size text not null check (shirt_size in ('XS','S','M','L','XL','2XL','3XL','4XL')), season_preference text not null check (season_preference in ('fall','spring','either')), notes text
);

create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), first_name text not null, last_name text not null, email text not null, phone text not null, season_preference text not null check (season_preference in ('fall','spring','both')), volunteer_roles text[] not null check (cardinality(volunteer_roles) > 0), notes text
);

alter table public.camper_applications enable row level security;
alter table public.volunteer_applications enable row level security;
revoke all on table public.camper_applications from anon, authenticated;
revoke all on table public.volunteer_applications from anon, authenticated;
grant select, insert, update, delete on table public.camper_applications to service_role;
grant select, insert, update, delete on table public.volunteer_applications to service_role;
create index if not exists camper_applications_created_at_idx on public.camper_applications (created_at desc);
create index if not exists volunteer_applications_created_at_idx on public.volunteer_applications (created_at desc);
