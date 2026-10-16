-- Add editable content for Michael Alexander Garza's memorial.
-- Existing site_settings RLS and admin-only write policies remain in effect.
alter table public.camp_rise_again_site_settings
  add column if not exists memorial_content jsonb not null default '{}'::jsonb;

-- Insert the new tribute after About without overwriting any custom card order.
update public.camp_rise_again_site_settings
set home_section_order = jsonb_insert(
  home_section_order,
  array[coalesce(
    (select x.ordinality::int from jsonb_array_elements_text(home_section_order)
       with ordinality as x(value, ordinality) where x.value = 'about' limit 1),
    jsonb_array_length(home_section_order)
  )::text],
  '"legacy"'::jsonb
)
where not home_section_order ? 'legacy';
