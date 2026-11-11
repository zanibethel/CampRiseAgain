-- Founder attribution uses the existing public-read, admin-write settings row.
-- No changes to the existing authorization policies are required.
alter table public.camp_rise_again_site_settings
  add column if not exists mission_author_name text not null default 'Tierra Schofield',
  add column if not exists mission_author_title text not null default 'Founder, Camp Rise Again';
