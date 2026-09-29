create policy "camp settings public read"
on public.camp_rise_again_site_settings
for select
using (true);

create policy "camp schedule public read"
on public.camp_rise_again_schedule
for select
using (true);
