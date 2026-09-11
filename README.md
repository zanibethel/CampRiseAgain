# Camp Rise Again

Next.js intake website for Camp Rise Again.

## Included
- Brand-ready homepage using the provided Camp Rise Again logo and colors
- Camper intake form: name, email, phone, address, birthday, shirt size, fall/spring/either preference, notes
- Volunteer form: food & beverage, camp mentor support, activity coordinator, transportation, setup, take down
- Supabase-backed server-only form storage with RLS and no public table access
- Resend email notification for each submission
- Placeholder About and Contact sections

## Required environment variables
Copy `.env.example` to `.env.local` and set:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `RESEND_API_KEY`
- `FORM_RECIPIENT_EMAIL`
- `FORM_FROM_EMAIL`

Current submission recipient: `Schofieldtierra@gmail.com`

## Database
Apply `supabase/migrations/20260911_create_camp_forms.sql` to the dedicated Camp Rise Again Supabase project.

## Privacy note
Camper applications contain address and date-of-birth information. Keep the Supabase tables server-only and restrict access to trusted camp administrators.
