# Camp Rise Again — Configurable Intake and Engagement Reporting
Date: 2026-11-12

## What changes
- Attendee (/apply) and volunteer (/volunteer) forms load active extra questions through the server-side Supabase bridge.
- Admin > Form Submissions can create/edit questions, choose form, answer type (short text, paragraph, dropdown, multiple choices, checkbox), options, required/optional, order and visibility.
- The question's immutable field key is used in historical reporting. Hiding a question does not erase old answers.
- Added starter optional questions for discovery source, preferred contact method, first camp, volunteer availability and experience. Review all wording with the camp team before making questions required.
- Each application saves validated answers to the existing restricted Supabase table's extra_answers JSONB column.
- The admin engagement summary shows exact total and last-30-day counts of camper, volunteer and contact submissions, plus volunteer interest breakdown.
- Admin engagement CSV export includes contact and engagement details plus configured answers, but deliberately excludes street addresses, birthdays, open-text notes and messages. Up to 1,000 records per type; larger exports are flagged as incomplete. Keep downloaded CSVs private.

## Security and privacy
- Storage is only in the existing shared CreatorHub Supabase project. No public Data API access is granted to the applicant records or field configuration table.
- The existing private Edge bridge verifies a server-only bearer token, and all admin_* operations additionally validate a Supabase-authenticated user against the Camp admin email allowlist.
- Public form configuration only exposes active question labels/types/options, never submission data.
- Server validation is authoritative; unknown/inactive answers are dropped, known answers are type/length/choice validated.
- Notification emails continue to contain only a reference and a link to the protected admin portal.
- Collect only necessary, non-clinical information. Do not ask for diagnoses, medications, or mental-health histories in configurable fields.
- Reports count submitted forms, not distinct people and not anonymous site visitors; repeated legitimate applications remain separate rows.
- CSV exports are private and should not be forwarded or stored in publicly shared drives. Individual sensitive application details remain visible only in the authenticated submission detail view.

## Deployment order
1. Review PR and run build/type checks. Verify existing tests and new routes.
2. Apply migration supabase/migrations/20261112170000_camp_form_fields_and_engagement.sql to CreatorHub project yufptpfiwdbzzrvhkvux. It is additive.
3. Deploy the updated camp-email-bridge Edge Function with existing verify_jwt=false and retained private bearer digest. Do not change its secret/key configuration.
4. Verify bridge endpoint actions from authenticated paths and test no-client-token unauthorized access; admin_field_list / admin_form_report / admin_export_submissions must reject unauthorized JWTs.
5. Merge and deploy website once database and Edge function are ready. Do not deploy website before its configuration endpoint works, because attendee and volunteer forms intentionally avoid submitting if extra questions fail to load.
6. Public test each form; confirm a real saved reference, correct extra_answers data, email receipt and staff notification, admin detail, CSV output, and 30-day count increments.
7. Sign out and verify admin endpoints reject requests; test attempt to submit unconfigured choice and oversized text.
8. Verify no full applicant details appear in outgoing staff email or public analytics.

## Limitations
- Aggregate role/season preference counts sample the 1,000 most recent applications of each relevant type; total submissions and last-30-day submission counts use exact database counts.
- CSV export currently returns up to 1,000 records per form type; the UI explicitly flags truncation.
- Reports reflect form submissions, not a unique-person CRM nor page-view analytics. A consented follow-up/outreach workflow is future work.
