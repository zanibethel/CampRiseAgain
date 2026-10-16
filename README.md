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
Camp Rise Again reuses the existing CreatorHub Supabase project to avoid an additional monthly project charge. Its data is isolated in dedicated tables:
- `camp_rise_again_camper_applications`
- `camp_rise_again_volunteer_applications`

The migration is stored at `supabase/migrations/20260911_create_camp_forms.sql` and has been applied to CreatorHub Supabase.

## Privacy note
Camper applications contain address and date-of-birth information. The Camp Rise Again tables use RLS, revoke anonymous/authenticated access, and are intended to be accessed only by trusted server-side code and camp administrators.

## Admin visitor report

The private `/admin` → **Visitor Analytics** panel retrieves the same aggregate metrics shown in the Vercel Web Analytics dashboard (visitors, page views, daily trends, pages, referrers). It refreshes every 60 seconds while open; Vercel's data may lag the live traffic slightly.

To complete setup, create an account access token at https://vercel.com/account/tokens with access to the `zanibethels-projects` team and add it **only as a server-side sensitive environment variable** named `VERCEL_ANALYTICS_READ_TOKEN` to the `camp-rise-again` Vercel project's Production environment (and Preview only if testing preview builds). Redeploy. Never send the token in chat, add it to GitHub, expose it as `NEXT_PUBLIC_*`, or paste it into the web admin. Token rotation/revocation is available from Vercel account settings.

The API route `/api/admin/visitor-analytics` verifies Supabase's authenticated user server-side, checks the fixed Camp Rise Again administrator email allowlist, and only then calls the Vercel API. Unauthenticated requests receive 401/403; the server access token is never included in responses. Browser cache is disabled. If configuration is missing, the admin panel displays a setup notice and a link to Vercel Analytics without substituting false counts.

## Admin sign-in and password recovery

Camp Rise Again keeps the existing Supabase email-link sign-in and also supports email/password sign-in for the same two authorized admin accounts. Accounts are **not** created by entering an email. To choose a password for an existing admin, open `/admin`, select **Forgot password? / Create one**, and request a recovery email. The email directs the admin to `/admin/reset-password`, where a verified Supabase session is required to choose and confirm a strong password.

**Important Supabase Auth setting:** In the existing Supabase project (`yufptpfiwdbzzrvhkvux`), under **Authentication → URL Configuration**, ensure `https://campriseagain.org/admin/reset-password` is included in the allowed **Redirect URLs**, alongside the existing `/admin` callback. If this path is absent, Supabase may ignore the requested redirect and send the user to the Site URL instead. Do not change the Supabase Site URL because this project is shared with another app. The recovery link uses the existing Supabase recovery-email template (no extra mail service).

After deploy, verify on a signed-out admin browser:
1. Enter an existing admin email and request a password recovery email.
2. Open the newest email link; it should display the **Create New Password** form at `https://campriseagain.org/admin/reset-password`. The link must be used before expiry.
3. Save a password of at least 12 characters and confirm it. Return to `/admin` and sign in with that password.
4. Sign out and confirm **Email Me a Sign-In Link** still works.
5. Confirm non-admin emails remain blocked.

Never write passwords, recovery tokens, access tokens, or user sessions to site settings, public storage, the repository, or logs. Supabase Auth stores and validates the password; client code only passes it to Supabase over the encrypted connection. The password recovery form verifies the active authenticated user's email against the existing admin allowlist.
