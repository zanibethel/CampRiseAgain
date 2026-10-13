-- Add an optional role / position displayed above each staff member's name.
-- Version matches the migration applied to the shared production Supabase project.
alter table public.camp_rise_again_team_members
  add column if not exists title text not null default '';

comment on column public.camp_rise_again_team_members.title is
  'Optional staff position or role shown in bold above the team member name.';
