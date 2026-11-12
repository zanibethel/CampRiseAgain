-- Camp Rise Again configurable intake questions. Answers stay in the private application tables.
alter table public.camp_rise_again_camper_applications
  add column if not exists extra_answers jsonb not null default '{}'::jsonb;
alter table public.camp_rise_again_volunteer_applications
  add column if not exists extra_answers jsonb not null default '{}'::jsonb;

create table if not exists public.camp_rise_again_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_kind text not null check (form_kind in ('camper', 'volunteer')),
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  label text not null check (char_length(label) between 3 and 160),
  input_type text not null check (input_type in ('short_text','long_text','select','multi_select','checkbox')),
  choices text[] not null default '{}',
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_kind, field_key),
  constraint choices_count check (cardinality(choices) <= 20)
);
alter table public.camp_rise_again_form_fields enable row level security;
revoke all on table public.camp_rise_again_form_fields from public, anon, authenticated;
grant select, insert, update, delete on table public.camp_rise_again_form_fields to service_role;
create index if not exists camp_form_fields_order_idx
  on public.camp_rise_again_form_fields(form_kind,sort_order,created_at);

-- Start with non-clinical, optional questions; staff can edit and add through /admin.
insert into public.camp_rise_again_form_fields
(form_kind,field_key,label,input_type,choices,required,sort_order)
values
('camper','how_heard','How did you hear about Camp Rise Again?','select',array['Friend or family','Social media','Community organization','Online search','Other'],false,10),
('camper','preferred_contact','How would you prefer we contact you?','select',array['Email','Phone call','Text message'],false,20),
('camper','first_camp','Will this be your first Camp Rise Again event?','checkbox','{}',false,30),
('volunteer','how_heard','How did you hear about Camp Rise Again?','select',array['Friend or family','Social media','Community organization','Online search','Other'],false,10),
('volunteer','preferred_contact','How would you prefer we contact you?','select',array['Email','Phone call','Text message'],false,20),
('volunteer','availability','When are you generally available?','multi_select',array['Weekdays','Weeknights','Weekends','Flexible'],false,30),
('volunteer','relevant_experience','Relevant skills or volunteer experience (optional)','long_text','{}',false,40)
on conflict (form_kind,field_key) do nothing;

comment on table public.camp_rise_again_form_fields is
  'Private definitions for public camper and volunteer questionnaires, served only through a narrow server bridge.';
