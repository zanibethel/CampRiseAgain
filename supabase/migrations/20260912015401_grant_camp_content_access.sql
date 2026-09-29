grant select on public.camp_rise_again_site_settings to anon, authenticated;
grant select on public.camp_rise_again_schedule to anon, authenticated;

grant insert, update, delete on public.camp_rise_again_site_settings to authenticated;
grant insert, update, delete on public.camp_rise_again_schedule to authenticated;

grant usage, select on sequence public.camp_rise_again_schedule_id_seq to authenticated;
