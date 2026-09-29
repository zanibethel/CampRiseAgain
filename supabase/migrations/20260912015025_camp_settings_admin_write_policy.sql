create policy "camp settings admin write"
on public.camp_rise_again_site_settings
for all
to authenticated
using (
  lower(auth.jwt() ->> 'email') = any (
    array['schofieldtierra@gmail.com','zanibethel@gmail.com']
  )
)
with check (
  lower(auth.jwt() ->> 'email') = any (
    array['schofieldtierra@gmail.com','zanibethel@gmail.com']
  )
);
