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
