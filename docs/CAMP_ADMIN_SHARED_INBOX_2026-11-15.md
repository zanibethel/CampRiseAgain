# Camp Rise Again — Admin shared email inbox (November 15, 2026)

## Goal

Allow approved Camp admins to read, reply to, archive, and start official one-to-one email conversations inside `/admin`, including a Compose action on each CRM contact. Preserve every existing forwarding address, reply alias, newsletter, and subscription rule.

## What this branch adds

- New **Camp Email Inbox** tab with General / Volunteers / Forms mailbox picker, Inbox / Sent / Archived folders, readable threads, message bodies rendered as plain text, Compose, Reply, and manual Refresh.
- Direct one-to-one emails can start from **Contacts & Announcements → Edit Contact → Send Official Email**, with a pre-filled recipient and the General mailbox. **Email History** opens contact-filtered threads across Inbox/Sent/Archive; switch Camp mailboxes to inspect each one (provider search may lag by about a minute).
- Only current Camp admins can access the server-side inbox route: each request is authenticated through the existing `camp-email-bridge` live admin directory. Inboxes and thread IDs are server-validated; the Resend key stays server-only.
- Outgoing messages use the dedicated `CAMP_RESEND_API_KEY` and existing three Resend inboxes, not the unrelated transactional email API or newsletter sender. Resend stores mail and threads; no new database tables or Supabase migration.
- Personal signatures are derived from an active, verified forwarding record matching the admin's validated JWT identity, when one exists. Other admins use “Camp Rise Again Team”.
- Every send requires an explicit browser confirmation showing recipient, subject, message, and signature. A generated idempotency key prevents accidental provider retries; new messages are created as drafts before sending so they appear in Sent.
- Incoming email HTML is never rendered or executed. For this first release attachments are listed by filename, not downloaded. No automatic AI processing of incoming messages.

## Critical integration and rollout checks

1. Verify the dedicated Camp Resend key has **full inbox access** (read/list/send), not sending-only access. Do not change other project keys. Existing Resend inboxes must remain intact: `info@`, `volunteer@`, and `forms@campriseagain.org`.
   - Verified Vercel configuration currently places `CAMP_RESEND_API_KEY` and `CAMP_SUPABASE_BRIDGE_TOKEN` in **production only**. The preview build can render the UI but cannot read/send real inbox mail without a separate, branch-scoped credential setup. Do **not** copy a production key indiscriminately into all preview environments.
2. Run `npm install --ignore-scripts`, `npm run test:mail`, and `npm run build` on the PR branch.
3. Test a signed-out user and a non-admin session cannot list/read/send mail.
4. In a Camp-admin preview session, open each mailbox, open a received message, read its plaintext, and verify **Inbox**, **Sent**, and **Archive** behavior. Verify the UI is usable on mobile.
5. From a consenting test external address, create an official email using CRM → Contact → Send Official Email, confirm the message and signature, and verify its outgoing thread in Sent, inbox delivery, and reply threading.
6. Reply from admin to an inbound test email. Confirm one email delivered and the thread updated. Test retries never create duplicate sends.
7. Confirm **Gmail forwarding and Gmail reply relay continue to work** in parallel and that form submissions and newsletters remain unchanged. Do not use sensitive camper or volunteer records as tests.
8. Monitor provider rate limits and errors, especially whether the Resend inbox API accepts the dedicated Camp key. If not, stop and adjust only the dedicated Camp key permissions after verification.
9. Merge and deploy only after CI passes and the inbox send/receive flow is verified in preview or a safe isolated environment.

## Constraints / later enhancements

- This is one-to-one communication, **not** a new mass mailing system. Newsletter consent and unsubscribe rules remain unchanged.
- Only the first 30 threads per page and first 100 emails of a conversation are currently shown; the More button supports additional thread pages.
- Shared read/archive state is global to the mailbox, not per-admin. This is a deliberate shared-inbox behavior.
- Attachments can be viewed in the provider inbox; downloads, inline HTML, CC/BCC, inbox assignments, per-admin audit ledger, and advanced search are future enhancements.
- Existing forwarded Gmail messages are copies. Outgoing messages sent directly through Gmail without the relay may not appear in Resend's inbox; new in-admin messages do.

## Preview credential limitation confirmed (November 15, 2026)

The Camp Vercel project stores `CAMP_RESEND_API_KEY` and `CAMP_SUPABASE_BRIDGE_TOKEN` as unreadable **production-only Secrets**. The connected Vercel API exposes the names, environment targets, and metadata, but **does not return either value**. We cannot securely copy them into a branch-scoped Preview environment without the original values or an authorized rotation. Avoid moving the existing production-only records to Preview: that would either affect production or potentially expose shared secrets to unrelated preview branches.

**User-owned setup path:** In Vercel → camp-rise-again → Settings → Environment Variables, add *new entries* for these same two keys, as Secret, targeted to Preview branch `feat/admin-shared-inbox-20261115` only, using the original values from the secure credential owner. Never paste secrets in chat, GitHub, or public build logs. If their originals are unavailable, plan a controlled rotation, explicitly preserving the existing working production relay throughout the transition. After saving, redeploy the preview branch to pick up the new values.

**Resend permission note:** The Inbox API requires a **full-access Resend API key** for list/read inbox and thread endpoints; a sending-only/domain-restricted API key can send replies/drafts but cannot list/read inbox messages. The connected Resend tool lists keys but does not reveal an existing key's permissions. Do not create or install a new full-account key without understanding it grants broader privileges across the shared Resend account (other projects use the same account). Prefer verifying the existing Camp key permissions first.

**Remaining verification:** With branch-scoped credentials configured, test the preview's live admin JWT authorization, inbox/thread reads, contact-based history, single test send and reply, Sent threading, and continued Gmail forwarder behavior. Then merge and verify production deployment. Do not merge based solely on an unauthenticated API or unit-test check.

## Isolated staged production-config verification (November 15, 2026)

A production-target deployment was built from this PR at commit `4cd5f312a53ff7f470b01372e7f28c213d5c1ffc`, deployment `dpl_CpDjThyw3Lwp3TgL6U9Rp8dkn9Y6`, URL `https://camp-rise-again-c4exiwjz1-zanibethels-projects.vercel.app`. Status: **READY**. It inherits the existing production environment variables without exporting/duplicating Secrets.

**Release safety:** During the production-config staging operation, the platform automatically assigned three production aliases to this build once it finished, despite auto-assignment being temporarily disabled. All affected aliases were immediately reassigned to the original production deployment `dpl_7dERwmgrr51qQPwMueASJLPbiEDv`: `campriseagain.org`, `camp-rise-again.vercel.app`, and `camp-rise-again-zanibethels-projects.vercel.app`; the `camp-rise-again-git-main` alias also continues to point to the original. Each was verified after restoration. Auto-assignment was restored to its prior enabled behavior. No PR merge occurred.

**Browser verification still required:** The deployment is protected by Vercel Authentication, which blocked a connected read-only web fetch of `/api/admin/inbox`. A real Camp admin should visit `https://camp-rise-again-c4exiwjz1-zanibethels-projects.vercel.app/admin`, sign into Vercel if prompted and then Camp Admin, and test Inbox/General opening the previous forwarding relay test thread. Then send an official test email to their own controlled address, reply, verify the new Sent/thread state, and confirm Gmail forwarding remains unchanged. Do not send sensitive camper/volunteer data in tests. This cannot be claimed verified until an actual authorized admin session completes it.

**Important:** Do not trigger another target=production deployment from the feature branch without explicit domain-assignment safeguards; a staged build can still overwrite production aliases when it reaches READY. The current separate deployment URL is sufficient for browser QA.

## Branded multipart email + safe HTML display (November 15, 2026)

This branch now sends `text` **and** `html` on:
- New official emails and threaded replies from the Camp admin inbox.
- Gmail-forwarded replies via `app/api/webhooks/camp-email/route.ts` (the route used in the controlled reply screenshot).
- Inbound-message copies forwarded from the Camp inbox to authorized Gmail forwarding recipients.

Every HTML email uses a shared, table-based Camp Rise Again branded layout with a public HTTPS logo, slogan, unchanged staff display-name/title signature, and a CampRiseAgain.org link. The public `site_settings.logo_path` from `camp-rise-again-branding` is consulted at send time; the bundled PNG is the fallback when the public logo is missing, invalid, or unavailable. User-entered text is **always escaped before HTML is generated**, not sent as arbitrary markup. `text` is preserved as a mail-client accessibility/fallback body.

Inbox message rendering now includes **View HTML / View Plain Text**. Received HTML is embedded only in an opaque, script-disabled sandboxed iframe with a restrictive Content Security Policy (no scripts, forms, remote fonts, connections, or active content). Remote images are blocked by default and may be explicitly enabled per message; doing so can expose the reader's IP to an external sender via tracking pixels. Links inside the preview cannot open/execute. Attachments remain viewable via Resend.

**Deployment verification:** Run `npm run test:mail` and `npm run build` in CI; test that an inbox-generated official email **and** a reply from a Gmail forwarder show the current logo and preserve the correct identity signature; verify the original `Reply-To` routing, threading, and no duplicate sends. Check both HTML and plain-text reader views and optionally allow remote images for an email from a trusted sender. Do not treat the earlier plain-text Gmail screenshot as proof that the updated HTML rendering works until the new build is verified.

**Note:** Campaign newsletters and Supabase authentication emails use separate outbound systems and have not been altered here; this change is scoped to operational Camp inbox messages and the existing Gmail forwarding/reply relay.
