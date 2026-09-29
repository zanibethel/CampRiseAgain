create policy "camp schedule admin write"
on public.camp_rise_again_schedule
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
