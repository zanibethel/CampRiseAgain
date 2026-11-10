-- Camp Rise Again editable FAQs. The table is service-role-only,
-- exposed publicly only through a narrowly scoped server endpoint.
create table if not exists public.camp_rise_again_faq_items (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('general','campers','volunteers')),
  question text not null check (char_length(btrim(question)) between 5 and 240),
  answer text not null check (char_length(btrim(answer)) between 1 and 3000),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint camp_faq_section_question_unique unique (section, question)
);
create index if not exists camp_faq_section_order_idx
  on public.camp_rise_again_faq_items(section,sort_order,id);
alter table public.camp_rise_again_faq_items enable row level security;
revoke all on public.camp_rise_again_faq_items from PUBLIC, anon, authenticated;
grant select,insert,update,delete on public.camp_rise_again_faq_items to service_role;

insert into public.camp_rise_again_faq_items
  (section,question,answer,sort_order,is_published) values
('general','What is Camp Rise Again?','Camp Rise Again is a peer-support camp for adults seeking connection, encouragement, and shared experiences.',10,true),
('general','Is Camp Rise Again a treatment program?','No. It is not therapy, medical treatment, or a crisis service and does not replace professional care.',20,true),
('general','How do I ask about dates, location or accessibility?','Send a question through our contact form. Camp details, accessibility considerations, and confirmed arrival information are shared by the team.',30,true),
('general','How can I help?','You can apply to volunteer, learn about supporting the mission, or get in touch through the contact form.',40,true),
('general','What if I need urgent mental-health support?','Camp Rise Again does not monitor emergencies. If someone is in immediate danger, call 911. In the United States, call or text 988 for mental-health crisis support.',50,true),
('campers','Who is the camp for?','Camp Rise Again is designed for adults who may be struggling with depression, isolation, or feeling disconnected. Contact us about any eligibility questions.',10,true),
('campers','Does applying guarantee a spot?','No. The team reviews applications and will contact applicants about next steps. Do not make travel arrangements based only on submitting an application.',20,true),
('campers','How do I apply?','Complete the online camper application. It submits directly to the team and sends you an email receipt with a reference number.',30,true),
('campers','What information is needed?','The application asks for your contact details, birthday, shirt size, season preference, and any information you choose to share for planning.',40,true),
('campers','Are dates and locations final?','Please use the website''s published schedule and confirm details with the team. Exact arrival instructions are provided to confirmed participants.',50,true),
('campers','Can I ask about accessibility or accommodations?','Yes. Use the contact form to describe a question or access need so the team can discuss what may be possible. Avoid sending detailed medical records through email.',60,true),
('campers','Is this therapy or clinical treatment?','No. Camp Rise Again provides peer connection and supportive activities, not clinical care or emergency services.',70,true),
('campers','What happens after I submit?','You will see an on-screen reference number and receive an email confirmation when delivery is available. The team reviews your submission and may follow up.',80,true),
('volunteers','How do I volunteer?','Submit the online volunteer interest form. It will go directly to the team without requiring your email app to open.',10,true),
('volunteers','What roles are available?','You can express interest in food and beverages, mentoring support, activities, transportation, setup, and take down. Final assignments depend on camp needs.',20,true),
('volunteers','Can I choose more than one area?','Yes. Select all the volunteer areas that interest you on the form.',30,true),
('volunteers','Do I need previous experience?','The form invites you to share any relevant experience. Contact the team if you are unsure which roles may suit you.',40,true),
('volunteers','When and where do volunteers report?','The team will share confirmed dates, locations, and next steps with volunteers. Submitting the form does not confirm an assignment.',50,true),
('volunteers','How will I hear back?','Your submission generates an on-screen receipt and a confirmation email when delivery is available. A team member may follow up from volunteer@campriseagain.org.',60,true),
('volunteers','Can I ask about accessibility or accommodations?','Yes. Use the contact form to ask about volunteer roles and access needs.',70,true)
on conflict (section,question) do nothing;

-- Atomically reorder every FAQ on one page; service role only.
create or replace function public.camp_rise_again_reorder_faqs(
  p_section text, p_ids uuid[]
)
returns boolean language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_matched integer;
begin
  if p_section not in ('general','campers','volunteers')
    or p_ids is null or cardinality(p_ids) > 100 then
    return false;
  end if;

  -- Serialize reorders on the chosen section within this transaction.
  perform pg_advisory_xact_lock(hashtext('camp_faq:' || p_section));
  select count(*) into v_count from public.camp_rise_again_faq_items where section=p_section;
  select count(distinct f.id) into v_matched
    from public.camp_rise_again_faq_items f
    join unnest(p_ids) u(id) on f.id=u.id
    where f.section=p_section;
  if v_count<>cardinality(p_ids) or v_matched<>v_count then
    return false;
  end if;

  update public.camp_rise_again_faq_items f
  set sort_order = (u.ord::integer)*10, updated_at = now()
  from unnest(p_ids) with ordinality as u(id,ord)
  where f.id=u.id and f.section=p_section;
  return true;
end;
$$;
revoke all on function public.camp_rise_again_reorder_faqs(text,uuid[])
  from PUBLIC, anon, authenticated;
grant execute on function public.camp_rise_again_reorder_faqs(text,uuid[])
  to service_role;
