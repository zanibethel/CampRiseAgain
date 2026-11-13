# Camp Rise Again Admin Management — November 12, 2026

## Access model
All **active**, verified Camp Rise Again administrators can manage site content **and**
help one another with administrator access under **Admin → Admin Management**.
The directory is shared across every browser and administrator.

Supported tasks:
- Add an administrator by their personal email and immediately email a secure
  activation invitation through Camp's Resend account.
- View active / inactive access, whether the Supabase account is verified,
  whether an invitation is pending, and the last access email date.
- Resend a password-creation or recovery email for an approved teammate.
- Restore previously removed access and invite that teammate again.
- Revoke a teammate's **Camp** privileges without deleting their shared
  Supabase identity, CreatorHub access or email-forwarding configuration.

The primary recovery account `zanibethel@gmail.com` cannot be removed, and
admins cannot remove themselves. The other admins have equal ability to invite,
restore or revoke another administrator.

## Security and data migration
- Private RLS-enabled directory: `public.camp_rise_again_admin_accounts`,
  with no `anon` or `authenticated` Data API permissions.
- Private audit ledger: `public.camp_rise_again_admin_audit`.
- Verified live membership function:
  `private.camp_rise_again_is_admin()`, which joins the current Supabase
  `auth.users` row to the active Camp directory, requiring a confirmed email.
- The migration updates exactly 18 **Camp-specific** database/storage policies.
  It fails rather than guessing if the policy shapes or number have changed.
  Public resource, schedule and team visibility are preserved.
- The public team policy only checks `is_visible`; an additional
  authenticated policy allows approved admins to see hidden members. Public
  browsers never require access to the private membership function.
- Every protected Camp bridge action checks current active membership. Email
  login and recovery cannot issue links to removed/unapproved addresses;
  unapproved requests receive generic responses.
- Server-side management API requires a valid Supabase access token for all
  actions, plus same-origin JSON for mutations. The Supabase service key
  remains only in the Edge environment.
- Access invitations and recovery use the current verified Camp Resend domain
  with `support@campriseagain.org` and the unmonitored-inbox notice.
- CreatorHub global Supabase Auth settings, user accounts and SMTP configuration
  are not touched. Mailing-list and forwarding verification remain separate.

## Release order
1. `npm run test:mail`, `npm run build` and Vercel preview.
2. Apply the exact checked, additive
   `20261113044000_camp_admin_management.sql` migration.
3. Confirm 4 seeded admins, protected primary recovery admin, RLS enabled,
   18 legacy hard-coded predicates removed and other policies preserved.
4. Deploy the updated `camp-email-bridge` without changing its bearer hash
   or JWT-verification setting. Confirm public form APIs still work.
5. Merge checked PR, verify exact production SHA is READY.
6. As a signed-in admin, open Admin Management, list all four users,
   invite a test admin **only with their agreement**, verify email delivery and
   activation; revoke and confirm access is denied, then restore.
7. Verify unapproved or unsigned requests cannot view admin member data,
   and the public application, volunteer and FAQ pages still load.

A site owner may revoke a previously added teammate by using Remove Access.
The teammate will lose Camp privileges on their next request even if they still
hold a Supabase session token. Do not delete that user from Supabase Auth,
since the account may be shared with another application.
