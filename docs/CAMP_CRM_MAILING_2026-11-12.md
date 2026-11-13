# Camp Rise Again CRM, Announcements and Newsletter
Date: 2026-11-12
Branch: feat/camp-crm-newsletters-20261112

## Implemented on branch
- A private Contacts & Announcements admin tab using the existing admin sign-in and private Supabase bridge.
- Contact deduplication by normalized email, with backfill of historical camper, volunteer and inquiry submissions and future sync via triggers.
- Basic profiles contain names, emails, phones, engagement source, private non-clinical notes, tags and stage. Full form answers, addresses, birthdays and personal messages remain separate in restricted submissions.
- A newsletter signup page, separate affirmative consent, 48-hour confirmation links and unsubscribe links.
- Draft announcements/newsletters, preview, deliberate sending to confirmed subscribers, durable batch delivery ledger (10 recipients per batch, maximum 500 per campaign), manual resume and provider idempotency keys.
- Newsletters use only the dedicated Camp Resend key and info@campriseagain.org.

## Security
- All five new public-schema tables have row level security and no anon/authenticated Data API permissions. The service-role bridge is privately authenticated with a hashed bearer, and every admin action additionally verifies a Supabase user against the fixed Camp admin allowlist.
- Application/volunteer/contact form completion never auto-subscribes a person to newsletters. Staff-added CRM contacts are also NOT subscribed.
- Unsubscribe signatures are per recipient and HMAC-signed with a separate stable server-only secret.
- Outbound promotional send requires the actual Camp Rise Again organization mailing address (physical address or PO box). No placeholder address may be used.
- Store only non-clinical notes. Do not segment by mental-health data or disclose who applied to camp.
- A provider send acceptance is not evidence of inbox delivery. Review suppressions, bounces and complaints before increasing mailing volume.

## Required configuration before activation
1. Run npm install --ignore-scripts, npm run test:mail and npm run build. Review the generated GitHub pull request and Vercel Preview.
2. In the Camp Vercel project, set CAMP_MAILING_SIGNING_SECRET (at least 32 random chars), CAMP_MAILING_POSTAL_ADDRESS (legitimate physical mailing address or PO box) and dedicated CAMP_RESEND_API_KEY as server-only sensitive environment variables.
3. Apply migration supabase/migrations/20261112213000_camp_crm_mailing.sql to shared CreatorHub Supabase yufptpfiwdbzzrvhkvux. It is additive, but test the trigger, grants, RLS, and distinct valid-contact count.
4. Deploy updated Supabase Edge Function camp-email-bridge retaining existing digest and verify_jwt=false configuration. Do not modify existing secret values.
5. Confirm existing form reporting, email forwarding, FAQ editing and media galleries continue to work. Deploy website only once bridge supports CRM/mailing actions.
6. Verify signed-out and non-admin users cannot access any CRM/admin data. Check no anon/authenticated Data API grant, and test subscription opt-in/expiry/unsubscribe with an expressly consenting test address.
7. Send a safe one-recipient test announcement only after all gates pass. Verify the unsubscribe removes that address from future batches.

## Current limitations
- CRM currently shows the latest 500 contacts, with a visible truncated warning. Server-side pagination is planned.
- Initial campaigns are limited to 500 confirmed recipients and sent in resumable batches initiated by an admin; there is not yet scheduled sending, automatic SMS, push alerts, or provider webhook reconciliation.
- Existing two-admin allowlist is unchanged. Role-granular staff permissions and audited changes should precede giving more staff access.
- Queued emails check subscriptions at claiming, but very long campaign queues benefit from a last-moment opt-out check.
- Failed delivery records require manual review, not automatic repeated marketing sends.