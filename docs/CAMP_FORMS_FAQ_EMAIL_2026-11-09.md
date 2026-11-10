# Camp Rise Again — web forms, FAQs, and email workflow

## Public routes
- `/faq`: general FAQ and links to the camper/volunteer questions.
- `/faq/campers`: peer-support information and direct `/apply` link.
- `/faq/volunteers`: volunteer information and direct `/volunteer` link.
- `/apply`, `/volunteer`, `/contact`: direct website submissions, no `mailto:`.

## Message routing
| Form | Notification From | Admin recipient scope | Confirmation From |
|---|---|---|---|
| Camper | forms@campriseagain.org | forms inbox recipients | forms@campriseagain.org |
| Volunteer | volunteer@campriseagain.org | volunteer inbox recipients | volunteer@campriseagain.org |
| Contact (general) | info@campriseagain.org | info inbox recipients | info@campriseagain.org |
| Contact (volunteering topic) | volunteer@campriseagain.org | volunteer inbox recipients | volunteer@campriseagain.org |
| Contact (camper application topic) | forms@campriseagain.org | forms inbox recipients | forms@campriseagain.org |

Staff notifications contain only a reference number, name and admin-review link, never camper addresses, birthdays, notes, or full contact messages. Each notification has a private `reply-<id>@campriseagain.org` Reply-To address. Verified recipients reply from Gmail, and the existing Resend webhook sends back from the original organization inbox with their saved name/title signature. These are not emails initiated directly in Gmail.

The protected `/admin` > Form Submissions tab permits authorized Camp admin accounts to view full private submission records after Supabase JWT verification by the Edge bridge. Do not share screenshot exports of camper submissions or forward sensitive details by email.

## Storage and security
The shared Supabase project contains:
- `camp_rise_again_camper_applications` (existing)
- `camp_rise_again_volunteer_applications` (existing)
- `camp_rise_again_contact_messages` (new)
- `camp_rise_again_form_rate_limits` (new)

All four are RLS-enabled and have no public or authenticated-user grants. The private Supabase Edge Function `camp-email-bridge` authenticates a Vercel-only bearer token before permitting limited operations, and checks the user's Supabase JWT and verified admin email for any `admin_*` action. Rate limiting is enforced by a service-role-only, SQL atomic increment RPC `camp_rise_again_claim_form_rate` with a 5-per-15-min window keyed by a server HMAC fingerprint, not raw IP or applicant email.

Private values are **never** added to GitHub or to `NEXT_PUBLIC_*` environment variables.

## Operational notes
- Each submission has an idempotency reference. Repeated identical browser requests do not create duplicate rows or duplicate emails.
- Data storage is authoritative even when a notification email fails. The UI shows a saved reference number and warns that notification may be delayed.
- The site is not a crisis service; applicants are directed to 911 or 988 for urgent support.
- Verify a non-sensitive live test of each form before publicizing the new workflow. Check recipient mail, submission record, confirmation, and a staff Gmail reply routed through the correct domain address.
- Form emails are subject to provider sending limits. Review staff delivery errors and spam throttle during early use.
- Public FAQ content deliberately avoids promises about camp location, eligibility decisions, availability, camp cost, and response times that have not been confirmed.
