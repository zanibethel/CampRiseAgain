# Custom Camp email aliases (draft, not production-ready)
Reuse existing verified receiving domain, webhook and email allowance; do not provision native Resend inboxes or change billing. Preserve existing info/volunteer/forms inboxes, support auth mail and reply aliases.
- Create and pause aliases in Email Forwarding; choose separately verified recipients and explicit active Camp admin login emails for mailbox ACL.
- Archive inbound plain text before forwarding; native inboxes remain separate in the same Admin Inbox tab. Authorized members can read, archive, compose and reply from the alias.
- Verified recipient records may have no native inbox selections (alias-only). No address or recipient is automatically created.
- New custom forwarded copies instruct users to reply through portal; Gmail reply relay remains available for existing native inboxes only until separately tested with sender authentication.
- No attachment binaries or HTML-only body archive yet; filenames and plain text only. Do not activate admin@ for nonprofit correspondence until secure attachment retrieval/storage, full message fidelity and delivery reconciliation are implemented.
- Forwarding reservations prevent duplicate attempts; uncertain deliveries are not automatically retried. Add admin delivery-state display, reconciliation and bounded retries before release.
- Need database migration and Edge Function deploy, plus build/CI, integration tests (invalid aliases, external recipients, ACL, forwarded copies, native regression, webhook duplicate events, provider failures, attachments), staging end-to-end test and production approval. No live changes from this draft.
