# Camp Rise Again — branded admin password recovery
Date: 2026-11-12

## Decision: app-specific recovery delivery, not a global Auth hook

Camp Rise Again and CreatorHub use the same Supabase Auth project.
Changing its global SMTP sender or Send Email Auth Hook would modify
CreatorHub account verification/password reset messages too.

Instead, Camp's existing **Forgot password? / Create one** form calls a
new server-only `POST /api/admin/request-password-reset` endpoint.
This endpoint uses the **existing** Supabase service key only on the
server to call `auth.admin.generateLink({type:"recovery"})`. This
creates a normal short-lived Supabase recovery action link **without**
sending a Supabase default email. It sends that link with the existing
Resend account from:

- From: **Camp Rise Again Support <support@campriseagain.org>**
- Subject: **Camp Rise Again — reset your admin password**
- Note: **This inbox is not monitored, and replies will not receive a response.
  If you experience any issues or need assistance, please visit
  https://campriseagain.org for contact information.**

The existing `/admin/reset-password` page consumes the Supabase
recovery link and allows the authorized admin to choose a new password.
The redirect must be allowlisted in shared Supabase Auth URL settings,
which were already required by the original password-recovery flow.

## Security

- No change to the global Supabase Auth SMTP, template, users or hook.
  CreatorHub email delivery and account confirmation remain untouched.
- Only the **two existing, allowlisted Camp admin addresses** may
  receive generated links. Recovery cannot register new users.
- The route runs only on the production Camp origin, requires
  same-origin JSON POST, validates the request body, and never exposes
  service credentials to the browser.
- Existing atomic `camp_rise_again_claim_form_rate` RPC throttles
  3 requests per 15 minutes per Vercel client address plus
  5 requests per hour per recipient; fingerprints use HMAC and no raw
  IP is sent to the database.
- Fail closed if credentials, rate limiting or email delivery fail.
- The generated action link is validated against the expected Supabase
  origin, exact Camp redirect and `type=recovery`. Links appear only
  inside the recipient's email; never in browser responses or logs.
- Responses for unregistered/non-admin accounts are generic.
- The sender address does not create a monitored inbox. No incoming
  email forwarding is configured for support@. Staff should direct
  people to the website's contact page.

## Activation and verification

1. Run `npm run test:mail` (includes scoped endpoint tests) and
   `npm run build`; review PR and Vercel preview.
2. Confirm production `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `CAMP_SUPABASE_BRIDGE_TOKEN`, and `CAMP_RESEND_API_KEY` remain
   configured. No new secrets or global auth config needed.
3. Confirm Resend `campriseagain.org` domain is verified for sending.
4. Merge only after successful CI, then verify the exact merge SHA
   is READY in Vercel production.
5. With a signed-out Camp admin browser, request a recovery email
   from an authorized account; confirm the sender and footer, open
   the fresh link, ensure `/admin/reset-password` works. Do not
   enter or reveal passwords/tokens during automated tests.
6. Verify CreatorHub signup and recovery still use their existing
   Supabase Auth sender; no email hook changes were made.
7. If emails fail, check Vercel function logs (never dump link
   contents), recipient spam folder and Resend delivery events.
   Revert this single app commit if needed to restore the previous
   `resetPasswordForEmail` flow.

## Out of scope

Camp's existing **Email Me a Sign-In Link** still uses the
project's default Supabase Auth email. Its sender is not changed.
Future customization can use the same app-scoped approach, but needs
the same rate limits and explicit user verification to avoid creating
new Supabase accounts with a magic-link action.
